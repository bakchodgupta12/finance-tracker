import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { ALL_MONTHS, parseExpenseDate } from '../shared';

// ── Constants ──────────────────────────────────────────────────────────────────
const RATING_COLORS = {
  'Excellent':  '#6dbb8a',
  'On Track':   '#5B9BD5',
  'Needs Work': '#E8A838',
  'Off Track':  '#D96B6B',
};

const PERIODS = [
  { id: 'thisMonth',   label: 'This Month'    },
  { id: 'lastMonth',   label: 'Last Month'    },
  { id: 'last3Months', label: 'Last 3 Months' },
  { id: 'custom',      label: 'Custom'        },
];

// ── Helper ─────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : { r: 0, g: 0, b: 0 };
}

function getMonthsFromDateRange(start, end) {
  const months = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    const abbr = ALL_MONTHS[d.getMonth()];
    if (!months.includes(abbr)) months.push(abbr);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

// ── Health Score Calculator ───────────────────────────────────────────────────
function calcHealthScore(state, periodMonths, baseIncome, allocByCat, toHome, totalLiabilities) {
  // Months with no actuals data are excluded from scoring entirely
  const blankMonths  = periodMonths.filter(m => {
    const a = state.actuals?.[m];
    return !a || !Object.values(a).some(v => Number(v) > 0);
  });
  const activeMonths = periodMonths.filter(m => !blankMonths.includes(m));

  // 1. Savings Discipline (35 pts) — only months that have actual data
  const savingsMonths = activeMonths.filter(m => {
    const a = state.actuals[m];
    return Number(a.Savings) > 0 || Number(a.Investments) > 0;
  });
  let savingsDiscipline = 0;
  if (savingsMonths.length > 0) {
    const plannedSavings = ((allocByCat.Savings || 0) + (allocByCat.Investments || 0)) / 100 * baseIncome;
    if (plannedSavings > 0) {
      const scores = savingsMonths.map(m => {
        const actual = (Number(state.actuals[m]?.Savings) || 0) + (Number(state.actuals[m]?.Investments) || 0);
        return Math.min(actual / plannedSavings, 1.0);
      });
      savingsDiscipline = (scores.reduce((s, v) => s + v, 0) / scores.length) * 35;
    }
  }

  // 2. Expense Discipline (30 pts) — only months that have actual data
  const expenseMonths = activeMonths.filter(m => {
    const a = state.actuals[m];
    return Number(a.Needs) > 0 || Number(a.Wants) > 0;
  });
  let expenseDiscipline = 0;
  if (expenseMonths.length > 0) {
    const plannedSpend = ((allocByCat.Needs || 0) + (allocByCat.Wants || 0)) / 100 * baseIncome;
    if (plannedSpend > 0) {
      const scores = expenseMonths.map(m => {
        const actual = (Number(state.actuals[m]?.Needs) || 0) + (Number(state.actuals[m]?.Wants) || 0);
        return actual <= plannedSpend ? 1.0 : plannedSpend / actual;
      });
      expenseDiscipline = (scores.reduce((s, v) => s + v, 0) / scores.length) * 30;
    }
  }

  // 3. Net Worth Direction (20 pts) — snapshots exist independently of actuals
  let netWorthDirection = 0;
  const snapMonths = periodMonths.filter(m => {
    const snap = state.accountSnapshots?.[m];
    return snap && Object.values(snap).some(v => v > 0);
  });
  if (snapMonths.length === 1) {
    netWorthDirection = 10;
  } else if (snapMonths.length >= 2) {
    const calcNW = (m) => {
      const snap = state.accountSnapshots?.[m] || {};
      const total = (state.accounts || []).reduce((sum, acc) => {
        const h = toHome(snap[acc.id] || 0, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      return total - totalLiabilities;
    };
    const earliest = calcNW(snapMonths[0]);
    const latest   = calcNW(snapMonths[snapMonths.length - 1]);
    if (earliest !== 0) {
      const changePct = ((latest - earliest) / Math.abs(earliest)) * 100;
      if (changePct > 5)        netWorthDirection = 20;
      else if (changePct > 0)   netWorthDirection = 15;
      else if (changePct >= -1) netWorthDirection = 8;
    } else {
      netWorthDirection = latest > 0 ? 20 : 0;
    }
  }

  // 4. Consistency (15 pts) — blank months excluded from denominator
  const monthsWithData = activeMonths.filter(m => {
    const a = state.actuals?.[m];
    return a && Object.values(a).some(v => Number(v) > 0);
  }).length;
  const consistency = activeMonths.length > 0
    ? (monthsWithData / activeMonths.length) * 15
    : 0;

  const total = Math.round(savingsDiscipline + expenseDiscipline + netWorthDirection + consistency);
  let rating;
  if (total >= 85)      rating = 'Excellent';
  else if (total >= 70) rating = 'On Track';
  else if (total >= 50) rating = 'Needs Work';
  else                  rating = 'Off Track';

  return {
    total,
    rating,
    breakdown: {
      savingsDiscipline: Math.round(savingsDiscipline),
      expenseDiscipline: Math.round(expenseDiscipline),
      netWorthDirection: Math.round(netWorthDirection),
      consistency:       Math.round(consistency),
    },
    excludedMonths: blankMonths,
  };
}

// ── Report Data Builder ───────────────────────────────────────────────────────
function buildReportData(state, periodMonths, healthScore, baseIncome, allocByCat, toHome, totalLiabilities, selectedYear, f, periodDates) {
  const homeCode = state.currencyCode || 'GBP';
  const yearStartMonth = state.yearStartMonth ?? 0;
  const startMonth = periodMonths[0] || '';
  const endMonth   = periodMonths[periodMonths.length - 1] || '';

  // Net worth at start and end of period
  const snapMonths = periodMonths.filter(m => {
    const snap = state.accountSnapshots?.[m];
    return snap && Object.values(snap).some(v => v > 0);
  });
  const calcNWForMonth = (m) => {
    const snap = state.accountSnapshots?.[m] || {};
    const total = (state.accounts || []).reduce((sum, acc) => {
      const h = toHome(snap[acc.id] || 0, acc.currency);
      return sum + (h ?? 0);
    }, 0);
    return total - totalLiabilities;
  };
  const nwStart = snapMonths.length > 0 ? calcNWForMonth(snapMonths[0]) : 0;
  const nwEnd   = snapMonths.length > 0 ? calcNWForMonth(snapMonths[snapMonths.length - 1]) : 0;
  const nwChange = nwEnd - nwStart;
  const nwChangePct = nwStart !== 0 ? ((nwChange / Math.abs(nwStart)) * 100).toFixed(1) : '0';

  // Savings rate
  const actualsMonths = periodMonths.filter(m => state.actuals?.[m]);
  let totalActualSavings = 0;
  actualsMonths.forEach(m => {
    totalActualSavings += (Number(state.actuals[m]?.Savings) || 0) + (Number(state.actuals[m]?.Investments) || 0);
  });
  const totalPlannedIncome = baseIncome * (actualsMonths.length || 1);
  const actualSavingsRate = totalPlannedIncome > 0
    ? ((totalActualSavings / totalPlannedIncome) * 100).toFixed(1)
    : '0';
  const plannedSavingsRate = (allocByCat.Savings || 0) + (allocByCat.Investments || 0);

  // Category expense breakdown
  const expenseBreakdown = ['Savings', 'Investments', 'Needs', 'Wants'].map(cat => {
    const planned = (allocByCat[cat] || 0) / 100 * baseIncome * (actualsMonths.length || 1);
    const actual  = actualsMonths.reduce((sum, m) => sum + (Number(state.actuals[m]?.[cat]) || 0), 0);
    return {
      category: cat,
      planned: Math.round(planned),
      actual:  Math.round(actual),
      diff:    Math.round(actual - planned),
      overBudget: actual > planned,
    };
  });

  // Filter expenses to period — use date range when available
  const getPeriodExpenses = () => {
    return (state.expenses || []).filter(exp => {
      if (!exp.date) return false;
      const d = parseExpenseDate(exp.date);
      if (!d) return false;
      if (periodDates) {
        return d >= periodDates.start && d <= periodDates.end;
      }
      const abbr = ALL_MONTHS[d.getMonth()];
      if (!periodMonths.includes(abbr)) return false;
      const mIdx = d.getMonth();
      const expYear = mIdx >= yearStartMonth ? selectedYear : selectedYear + 1;
      return d.getFullYear() === expYear;
    });
  };
  const periodExpenses = getPeriodExpenses();

  const totalExpenses = Math.round(
    periodExpenses.reduce((s, e) => s + (toHome(Number(e.amount) || 0, e.currency) || 0), 0)
  );

  // Period comparison — same duration immediately before current period
  let comparison = null;
  if (periodDates) {
    const duration = periodDates.end.getTime() - periodDates.start.getTime();
    const prevStart = new Date(periodDates.start.getTime() - duration);
    const prevEnd   = new Date(periodDates.start.getTime() - 86400000);
    const prevExpenses = (state.expenses || []).filter(exp => {
      if (!exp.date) return false;
      const d = parseExpenseDate(exp.date);
      if (!d) return false;
      return d >= prevStart && d <= prevEnd;
    });
    if (prevExpenses.length > 0) {
      const prevTotal = Math.round(
        prevExpenses.reduce((s, e) => s + (toHome(Number(e.amount) || 0, e.currency) || 0), 0)
      );
      comparison = {
        hasPrevData: true,
        prevTotal,
        currentTotal: totalExpenses,
        change: Math.round(totalExpenses - prevTotal),
        changePct: prevTotal > 0 ? ((totalExpenses - prevTotal) / prevTotal * 100).toFixed(1) : null,
      };
    } else {
      comparison = { hasPrevData: false };
    }
  }

  // Spend by category (for PDF bar chart)
  const catTotals = {};
  periodExpenses.forEach(e => {
    const cat = e.category || 'Other';
    catTotals[cat] = (catTotals[cat] || 0) + (toHome(Number(e.amount) || 0, e.currency) || 0);
  });
  const categoryColorMap = {};
  (state.expenseCategories || []).forEach(c => {
    if (c.name) categoryColorMap[c.name] = c.color || '#E8A598';
  });
  const spendByCategory = Object.entries(catTotals)
    .map(([name, total]) => ({ name, total: Math.round(total), color: categoryColorMap[name] || '#E8A598' }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Top 5 expenses by home-currency amount
  const topExpenses = [...periodExpenses]
    .sort((a, b) => (toHome(Number(b.amount) || 0, b.currency) || 0) - (toHome(Number(a.amount) || 0, a.currency) || 0))
    .slice(0, 5)
    .map(e => ({
      description: e.description,
      amount: Math.round(toHome(Number(e.amount) || 0, e.currency) || 0),
      category: e.category,
      date: e.date,
    }));

  // Monthly spend trend
  const monthlySpendTrend = periodMonths.map(m => {
    const mIdx = ALL_MONTHS.indexOf(m);
    const yr = mIdx >= yearStartMonth ? selectedYear : selectedYear + 1;
    const total = (state.expenses || [])
      .filter(e => {
        if (!e.date) return false;
        const d = parseExpenseDate(e.date);
        return d && d.getFullYear() === yr && d.getMonth() === mIdx;
      })
      .reduce((sum, e) => sum + (toHome(Number(e.amount) || 0, e.currency) || 0), 0);
    return { month: m, total: Math.round(total) };
  }).filter(d => d.total > 0);

  // Dining vs groceries
  const diningCats = ['Food', 'Dining', 'Drinks', 'Entertainment'];
  const diningTotal    = periodExpenses.filter(e => diningCats.includes(e.category)).reduce((s, e) => s + (toHome(Number(e.amount) || 0, e.currency) || 0), 0);
  const groceriesTotal = periodExpenses.filter(e => e.category === 'Groceries').reduce((s, e) => s + (toHome(Number(e.amount) || 0, e.currency) || 0), 0);

  // Allocation adherence
  const mn = actualsMonths.length || 1;
  const allocationAdherence = {
    planned: {
      savings:     Math.round((allocByCat.Savings     || 0) / 100 * baseIncome),
      investments: Math.round((allocByCat.Investments || 0) / 100 * baseIncome),
      needs:       Math.round((allocByCat.Needs        || 0) / 100 * baseIncome),
      wants:       Math.round((allocByCat.Wants        || 0) / 100 * baseIncome),
    },
    actual: {
      savings:     Math.round(actualsMonths.reduce((s, m) => s + (Number(state.actuals[m]?.Savings) || 0), 0) / mn),
      investments: Math.round(actualsMonths.reduce((s, m) => s + (Number(state.actuals[m]?.Investments) || 0), 0) / mn),
      needs:       Math.round(actualsMonths.reduce((s, m) => s + (Number(state.actuals[m]?.Needs) || 0), 0) / mn),
      wants:       Math.round(actualsMonths.reduce((s, m) => s + (Number(state.actuals[m]?.Wants) || 0), 0) / mn),
    },
  };

  // Projected goal date from current monthly growth rate
  let projectedGoalDate = null;
  const goalNW = state.goalNetWorth || 0;
  if (goalNW > 0 && nwChange > 0 && actualsMonths.length > 0) {
    const monthlyGrowth = nwChange / actualsMonths.length;
    const remaining = goalNW - nwEnd;
    if (remaining <= 0) {
      projectedGoalDate = 'Already reached';
    } else if (monthlyGrowth > 0) {
      const monthsNeeded = Math.ceil(remaining / monthlyGrowth);
      const d = new Date();
      d.setMonth(d.getMonth() + monthsNeeded);
      projectedGoalDate = `${ALL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
  }

  const periodLabel = periodDates
    ? periodDates.label
    : `${startMonth} to ${endMonth} ${selectedYear}`;

  const excludedMonthLabels = (healthScore.excludedMonths || []).map(m => {
    const mIdx = ALL_MONTHS.indexOf(m);
    const yr = mIdx >= yearStartMonth ? selectedYear : selectedYear + 1;
    return `${m} ${yr}`;
  });

  return {
    period: { label: periodLabel, startMonth, endMonth },
    healthScore,
    excludedMonths: excludedMonthLabels,
    netWorth: { start: Math.round(nwStart), end: Math.round(nwEnd), change: Math.round(nwChange), changePct: parseFloat(nwChangePct) },
    savingsRate: { planned: plannedSavingsRate, actual: parseFloat(actualSavingsRate), gap: parseFloat((plannedSavingsRate - parseFloat(actualSavingsRate)).toFixed(1)) },
    expenseBreakdown,
    topExpenses,
    totalExpenses,
    comparison,
    spendByCategory,
    subscriptions: state.subscriptions,
    monthlySpendTrend,
    diningVsGroceries: { dining: Math.round(diningTotal), groceries: Math.round(groceriesTotal), ratio: groceriesTotal > 0 ? (diningTotal / groceriesTotal).toFixed(2) : null },
    allocationAdherence,
    netWorthGoal: goalNW,
    projectedGoalDate,
    currency: homeCode,
  };
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
function generatePDF(aiContent, reportData, currency, displayName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageW  = 210;
  const pageH  = 297;
  const usableW = pageW - 2 * margin;
  const today   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sym    = currency.symbol;
  const locale = currency.locale;
  const fPDF = (v) => {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}m`;
    return `${sign}${sym}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs)}`;
  };

  const ratingColor = RATING_COLORS[reportData.healthScore.rating] || '#9e9890';
  const rc = hexToRgb(ratingColor);

  let pageNum = 0;
  const addFooter = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(176, 170, 159);
    doc.text(`Generated by Finance Tracker · ${today}`, margin, pageH - 10);
    doc.text(`${pageNum} of 6`, pageW - margin, pageH - 10, { align: 'right' });
  };

  // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
  pageNum = 1;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');

  let y = margin + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(26, 23, 20);
  doc.text('Financial Health Report', pageW / 2, y, { align: 'center' });
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(107, 102, 96);
  doc.text(`${displayName || 'Your'} finances — ${reportData.period.label}`, pageW / 2, y, { align: 'center' });
  y += 22;

  // Health score circle
  const circleX = pageW / 2;
  const circleR = 26;
  const circleY = y + circleR;
  doc.setFillColor(rc.r, rc.g, rc.b);
  doc.circle(circleX, circleY, circleR, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(255, 255, 255);
  doc.text(String(reportData.healthScore.total), circleX, circleY + 2, { align: 'center' });
  doc.setFontSize(10);
  doc.text(reportData.healthScore.rating, circleX, circleY + 11, { align: 'center' });
  y = circleY + circleR + 14;

  // punchySummary — italic grey text below circle
  if (aiContent.punchySummary) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(100, 96, 90);
    const summaryLines = doc.splitTextToSize(aiContent.punchySummary, usableW);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 7 + 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 23, 20);
  }

  // Score breakdown box
  const boxH = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(232, 228, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, usableW, boxH, 3, 3, 'FD');

  const scoreRows = [
    ['Savings Discipline', `${reportData.healthScore.breakdown.savingsDiscipline} / 35`],
    ['Expense Discipline', `${reportData.healthScore.breakdown.expenseDiscipline} / 30`],
    ['Net Worth Direction', `${reportData.healthScore.breakdown.netWorthDirection} / 20`],
    ['Consistency', `${reportData.healthScore.breakdown.consistency} / 15`],
  ];
  let sy = y + 9;
  scoreRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 102, 96);
    doc.text(label, margin + 8, sy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 23, 20);
    doc.text(value, pageW - margin - 8, sy, { align: 'right' });
    sy += 9;
  });

  y += boxH + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 23, 20);
  doc.text('TOTAL SCORE', margin + 8, y);
  doc.text(`${reportData.healthScore.total} / 100`, pageW - margin - 8, y, { align: 'right' });
  y += 10;

  // Excluded month notices
  if (reportData.excludedMonths?.length > 0) {
    reportData.excludedMonths.forEach(mLabel => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(176, 170, 159);
      const nl = doc.splitTextToSize(`Note: ${mLabel} had no logged data and was excluded from scoring.`, usableW - 4);
      doc.text(nl, margin, y);
      y += nl.length * 4 + 2;
    });
    y += 4;
  } else {
    y += 4;
  }

  // First key finding
  if (aiContent.keyFindings?.[0]) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(rc.r, rc.g, rc.b);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, usableW, 20, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(158, 152, 144);
    doc.text('KEY FINDING', margin + 7, y + 7);
    const fl = doc.splitTextToSize(aiContent.keyFindings[0], usableW - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(26, 23, 20);
    doc.text(fl[0] || '', margin + 7, y + 15);
  }

  addFooter();

  // ── PAGE 2: KEY FINDINGS & MONEY LEAKS ────────────────────────────────────
  doc.addPage();
  pageNum = 2;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');
  y = margin + 10;

  const sectionHeader = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(26, 23, 20);
    doc.text(title, margin, y);
    y += 5;
    doc.setDrawColor(232, 228, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  };

  sectionHeader('WHAT THE NUMBERS ARE TELLING YOU');

  (aiContent.keyFindings || []).forEach((finding, i) => {
    if (y > pageH - margin - 20) { doc.addPage(); y = margin + 8; }
    const lines = doc.splitTextToSize(`${i + 1}.  ${finding}`, usableW - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 38);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  });

  // Period comparison
  if (reportData.comparison) {
    y += 4;
    if (reportData.comparison.hasPrevData) {
      const decreased = reportData.comparison.change <= 0;
      const arrowColor = decreased ? [45, 158, 107] : [217, 107, 107];
      const sign = decreased ? '' : '+';
      const pct  = reportData.comparison.changePct !== null ? `${sign}${reportData.comparison.changePct}%` : '';
      const fromTo = `${fPDF(reportData.comparison.prevTotal)} → ${fPDF(reportData.comparison.currentTotal)}`;
      const compText = `vs previous period: ${pct} (${fromTo})`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...arrowColor);
      doc.text(compText, margin, y);
      y += 10;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(176, 170, 159);
      doc.text('No previous period data to compare.', margin, y);
      y += 10;
    }
  }

  // ── SPEND BY CATEGORY CHART ────────────────────────────────────────────────
  if (reportData.spendByCategory?.length > 0) {
    y += 8;
    if (y > pageH - margin - 80) { doc.addPage(); y = margin + 8; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 23, 20);
    doc.text('SPEND BY CATEGORY', margin, y);
    y += 5;
    doc.setDrawColor(232, 228, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    const nameColW = 52;
    const amtColW  = 22;
    const barAreaW = usableW - nameColW - amtColW;
    const barX     = margin + nameColW;
    const maxCatTotal = reportData.spendByCategory[0].total || 1;
    const barH = 3;
    const rowH = 8;

    reportData.spendByCategory.forEach(cat => {
      if (y > pageH - margin - rowH) { doc.addPage(); y = margin + 8; }

      // Category name (left column)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(45, 42, 38);
      doc.text(String(cat.name || '').slice(0, 22), margin, y + 5.5);

      // Bar track (grey background)
      doc.setFillColor(240, 237, 232);
      doc.roundedRect(barX, y + 2, barAreaW, barH, 1, 1, 'F');

      // Bar fill (category colour, proportional to max)
      const fillW = Math.max((cat.total / maxCatTotal) * barAreaW, 1);
      const cc = hexToRgb(cat.color || '#E8A598');
      doc.setFillColor(cc.r, cc.g, cc.b);
      doc.roundedRect(barX, y + 2, fillW, barH, 1, 1, 'F');

      // Amount (right column)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(45, 42, 38);
      doc.text(fPDF(cat.total), margin + usableW, y + 5.5, { align: 'right' });

      y += rowH;
    });
    y += 4;
  }

  y += 6;
  sectionHeader('MONEY LEAKS IDENTIFIED');

  let totalLeakage = 0;
  (aiContent.moneyLeaks || []).forEach(leak => {
    if (y > pageH - margin - 30) { doc.addPage(); y = margin + 8; }
    const cost = Number(leak.estimatedMonthlyCost) || 0;
    totalLeakage += cost;

    const titleLines = doc.splitTextToSize(leak.title || '', usableW - 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 23, 20);
    doc.text(titleLines, margin, y);
    if (cost > 0) {
      doc.setTextColor(217, 107, 107);
      doc.text(`-${fPDF(cost)}/mo`, pageW - margin, y, { align: 'right' });
    }
    y += titleLines.length * 5 + 2;

    if (leak.description) {
      const dl = doc.splitTextToSize(leak.description, usableW);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 102, 96);
      doc.text(dl, margin, y);
      y += dl.length * 4.5 + 8;
    }
  });

  if (totalLeakage > 0) {
    y += 4;
    doc.setDrawColor(232, 228, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(217, 107, 107);
    doc.text(`Estimated total monthly leakage: ${fPDF(totalLeakage)}`, margin, y);
    doc.text(`Annual: ${fPDF(totalLeakage * 12)}`, pageW - margin, y, { align: 'right' });
  }

  addFooter();

  // ── PAGE 3: OFF PLAN ANALYSIS ──────────────────────────────────────────────
  doc.addPage();
  pageNum = 3;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');
  y = margin + 10;

  sectionHeader("WHERE YOU'RE OFF YOUR OWN PLAN");

  if (aiContent.offPlanAnalysis) {
    const opaLines = doc.splitTextToSize(aiContent.offPlanAnalysis, usableW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 38);
    // Page-break-safe text rendering
    opaLines.forEach(line => {
      if (y > pageH - margin - 20) { doc.addPage(); y = margin + 8; }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 10;
  }

  // Category grades table
  if (y > pageH - margin - 60) { doc.addPage(); y = margin + 8; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 23, 20);
  doc.text('CATEGORY GRADES', margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(158, 152, 144);
  doc.text('CATEGORY', margin, y);
  doc.text('GRADE', margin + 58, y);
  doc.text('COMMENT', margin + 80, y);
  y += 5;
  doc.setDrawColor(232, 228, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const gradeColors = { A: '#6dbb8a', B: '#5B9BD5', C: '#E8A838', D: '#D96B6B', F: '#D96B6B' };
  (aiContent.categoryGrades || []).forEach(grade => {
    if (y > pageH - margin - 20) { doc.addPage(); y = margin + 8; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(45, 42, 38);
    doc.text(grade.category || '', margin, y);
    const gc = grade.grade === 'N/A'
      ? { r: 176, g: 170, b: 159 }
      : hexToRgb(gradeColors[grade.grade] || '#9e9890');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(gc.r, gc.g, gc.b);
    doc.text(grade.grade || '', margin + 58, y);
    if (grade.comment) {
      const cl = doc.splitTextToSize(grade.comment, usableW - 82);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 102, 96);
      doc.text(cl, margin + 80, y);
      y += Math.max(cl.length * 4.5, 6) + 5;
    } else {
      y += 10;
    }
  });

  addFooter();

  // ── PAGE 4: ACTION PLAN ────────────────────────────────────────────────────
  doc.addPage();
  pageNum = 4;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');
  y = margin + 10;

  sectionHeader('YOUR ACTION PLAN');

  const actionSections = [
    { key: 'painlessCuts',    label: 'PAINLESS CUTS',            effort: 'Low effort',    color: '#6dbb8a' },
    { key: 'behaviourChanges', label: 'SMALL BEHAVIOUR CHANGES', effort: 'Medium effort', color: '#5B9BD5' },
    { key: 'bigMoves',         label: 'BIG MOVES',               effort: 'High impact',   color: '#E8A838' },
  ];

  let totalMonthlySaving = 0;

  actionSections.forEach(section => {
    const items = aiContent.actionPlan?.[section.key] || [];
    if (items.length === 0) return;
    if (y > pageH - margin - 40) { doc.addPage(); y = margin + 8; }

    const sc = hexToRgb(section.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(sc.r, sc.g, sc.b);
    doc.text(section.label, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 170, 160);
    doc.text(section.effort, margin, y);
    y += 8;
    doc.setTextColor(26, 23, 20);

    items.forEach((item, i) => {
      if (y > pageH - margin - 18) { doc.addPage(); y = margin + 8; }
      const al = doc.splitTextToSize(`${i + 1}.  ${item.action || ''}`, usableW - 38);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(45, 42, 38);
      doc.text(al, margin, y);
      const saving = Number(item.monthlySaving) || 0;
      if (saving > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(45, 158, 107);
        doc.text(`+${fPDF(saving)}/mo`, pageW - margin, y, { align: 'right' });
        totalMonthlySaving += saving;
      }
      y += al.length * 5 + 4;
    });
    y += 6;
  });

  if (y > pageH - margin - 28) { doc.addPage(); y = margin + 8; }
  y += 4;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, usableW, 22, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(45, 158, 107);
  doc.text(`Total potential monthly saving: ${fPDF(totalMonthlySaving)}`, margin + 8, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 102, 96);
  doc.text(`Annual impact: ${fPDF(totalMonthlySaving * 12)}`, margin + 8, y + 17);

  addFooter();

  // ── PAGE 5: FORWARD PROJECTION ─────────────────────────────────────────────
  doc.addPage();
  pageNum = 5;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');
  y = margin + 10;

  sectionHeader("WHERE YOU'RE HEADED");

  // Compute box height from content
  const boxW = (usableW - 8) / 2;
  const ctText = aiContent.forwardProjection?.currentTrajectory || '';
  const apText = aiContent.forwardProjection?.withActionPlan || '';
  const ctLines = doc.splitTextToSize(ctText, boxW - 12);
  const apLines = doc.splitTextToSize(apText, boxW - 12);
  const dynBoxH = Math.max(ctLines.length, apLines.length) * 4.5 + 22;

  // Left: current trajectory
  doc.setFillColor(249, 247, 243);
  doc.setDrawColor(232, 228, 220);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, boxW, dynBoxH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(107, 102, 96);
  doc.text('Current Trajectory', margin + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(45, 42, 38);
  doc.text(ctLines, margin + 6, y + 16);

  // Right: with action plan
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin + boxW + 8, y, boxW, dynBoxH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(45, 158, 107);
  doc.text('With Action Plan', margin + boxW + 14, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(45, 42, 38);
  doc.text(apLines, margin + boxW + 14, y + 16);

  y += dynBoxH + 16;

  // ── Chart A: Net Worth Growth ───────────────────────────────────────────────
  {
    if (y > pageH - margin - 40) { doc.addPage(); y = margin + 8; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(158, 152, 144);
    doc.text('NET WORTH GROWTH', margin, y);
    y += 6;

    const nwStart    = reportData.netWorth.start;
    const nwEnd      = reportData.netWorth.end;
    const grew       = nwEnd >= nwStart;
    const maxNW      = Math.max(Math.abs(nwStart), Math.abs(nwEnd)) || 1;
    const nwFillW    = Math.min((Math.abs(nwEnd) / maxNW) * usableW, usableW);
    const nwBarColor = grew ? { r: 45, g: 158, b: 107 } : { r: 217, g: 107, b: 107 };

    doc.setFillColor(240, 237, 232);
    doc.roundedRect(margin, y, usableW, 4, 1.5, 1.5, 'F');
    doc.setFillColor(nwBarColor.r, nwBarColor.g, nwBarColor.b);
    if (nwFillW > 0) doc.roundedRect(margin, y, nwFillW, 4, 1.5, 1.5, 'F');
    y += 7;

    const nwSign = reportData.netWorth.changePct >= 0 ? '+' : '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 102, 96);
    doc.text(`${nwSign}${reportData.netWorth.changePct}% since last period`, margin, y);
    y += 12;
  }

  // ── Chart B: Goal Progress ──────────────────────────────────────────────────
  if (reportData.netWorthGoal > 0) {
    if (y > pageH - margin - 30) { doc.addPage(); y = margin + 8; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(158, 152, 144);
    doc.text('GOAL PROGRESS', margin, y);
    y += 6;

    const goalPct   = Math.min((reportData.netWorth.end || 0) / reportData.netWorthGoal * 100, 100);
    const goalFillW = Math.max((goalPct / 100) * usableW, 0);
    const bc        = hexToRgb('#5B9BD5');

    doc.setFillColor(240, 237, 232);
    doc.roundedRect(margin, y, usableW, 4, 1.5, 1.5, 'F');
    doc.setFillColor(bc.r, bc.g, bc.b);
    if (goalFillW > 0) doc.roundedRect(margin, y, goalFillW, 4, 1.5, 1.5, 'F');
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 102, 96);
    doc.text(
      `${goalPct.toFixed(0)}% of goal  ·  ${fPDF(reportData.netWorth.end)} of ${fPDF(reportData.netWorthGoal)}`,
      margin, y,
    );
    y += 10;
  }

  addFooter();

  // ── PAGE 6: VERDICT ────────────────────────────────────────────────────────
  doc.addPage();
  pageNum = 6;
  doc.setFillColor(247, 245, 240);
  doc.rect(0, 0, pageW, pageH, 'F');
  y = margin + 10;

  sectionHeader('THE VERDICT');

  if (aiContent.closingVerdict) {
    const vl = doc.splitTextToSize(aiContent.closingVerdict, usableW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(26, 23, 20);
    vl.forEach(line => {
      if (y > pageH - margin - 30) return;
      doc.text(line, margin, y);
      y += 7;
    });
  }

  // Disclaimer
  const disclaimerLines = doc.splitTextToSize(
    'This report was generated using your personal finance data combined with AI analysis. It is for informational purposes only and does not constitute financial advice.',
    usableW,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(176, 170, 159);
  doc.text(disclaimerLines, margin, pageH - margin - 8);

  addFooter();

  // Download
  const d = new Date();
  doc.save(`Financial-Health-Report-${ALL_MONTHS[d.getMonth()]}-${d.getFullYear()}.pdf`);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HealthCheckup({
  open, onClose,
  state, set, f, currency, MONTHS, allocByCat, baseIncome,
  toHome, totalLiabilities, selectedYear,
}) {
  const [period,        setPeriod]        = useState('last3Months');
  const [customStart,   setCustomStart]   = useState('');
  const [customEnd,     setCustomEnd]     = useState('');
  const [loading,       setLoading]       = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error,         setError]         = useState(null);
  const loadingIntervalRef = useRef(null);

  const LOADING_MESSAGES = [
    'Analysing your finances…',
    'Calculating your health score…',
    'Identifying patterns…',
    'Writing your report…',
  ];

  const startLoadingMessages = () => {
    setLoadingMessage(LOADING_MESSAGES[0]);
    let idx = 1;
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMessage(LOADING_MESSAGES[idx % LOADING_MESSAGES.length]);
      idx++;
    }, 3000);
  };

  const stopLoadingMessages = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  useEffect(() => () => stopLoadingMessages(), []);

  // Usage
  const currentMonth  = new Date().toISOString().slice(0, 7);
  const usage         = state.checkupUsage || { month: '', count: 0 };
  const usageCount    = usage.month === currentMonth ? usage.count : 0;

  // Period helpers
  const getPeriodDates = (p, csStart, csEnd) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (p === 'thisMonth') {
      const start = new Date(y, m, 1);
      const end   = new Date(y, m + 1, 0);
      return { start, end, label: `${ALL_MONTHS[m]} ${y}` };
    }
    if (p === 'lastMonth') {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const start = new Date(ly, lm, 1);
      const end   = new Date(ly, lm + 1, 0);
      return { start, end, label: `${ALL_MONTHS[lm]} ${ly}` };
    }
    if (p === 'last3Months') {
      const end   = new Date(y, m + 1, 0);
      const start = new Date(y, m - 2, 1);
      const sl = ALL_MONTHS[start.getMonth()];
      const el = ALL_MONTHS[end.getMonth()];
      const label = start.getFullYear() === end.getFullYear()
        ? `${sl}–${el} ${end.getFullYear()}`
        : `${sl} ${start.getFullYear()}–${el} ${end.getFullYear()}`;
      return { start, end, label };
    }
    if (p === 'custom' && csStart && csEnd) {
      const start = new Date(csStart);
      const end   = new Date(csEnd);
      const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
    }
    return null;
  };

  const getPeriodLabel = (p) => {
    const dates = getPeriodDates(p, customStart, customEnd);
    return dates ? dates.label : '';
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    startLoadingMessages();
    onClose();

    const periodDates   = getPeriodDates(period, customStart, customEnd);
    const periodMonths  = periodDates ? getMonthsFromDateRange(periodDates.start, periodDates.end) : [];
    const healthScore   = calcHealthScore(state, periodMonths, baseIncome, allocByCat, toHome, totalLiabilities);
    const reportData    = buildReportData(state, periodMonths, healthScore, baseIncome, allocByCat, toHome, totalLiabilities, selectedYear, f, periodDates);
    const displayName   = (state.displayName?.trim()) ||
      (state.userId ? state.userId.charAt(0).toUpperCase() + state.userId.slice(1).toLowerCase() : '');

    const prompt = `You are a direct, honest financial advisor reviewing someone's personal finances. Your job is to tell them exactly what the numbers mean and what they should do — no fluff, no corporate speak, no sugarcoating.

CRITICAL: Complete every sentence fully. Never truncate any field. Never end a sentence with a comma or mid-word. Every string in the JSON must be a complete, grammatically correct sentence or list item.

Only reference subscriptions and expenses that appear in the data below. Do not invent or assume any transactions.

Here is their financial data for ${reportData.period.label}:
${JSON.stringify(reportData, null, 2)}

Write a financial health report with exactly these sections. Respond in JSON with this structure:
{
  "punchySummary": "One or two punchy lines summarising the key financial story. Use real numbers. Be direct.",
  "keyFindings": [
    "Finding 1 — one punchy sentence with a specific number",
    "Finding 2",
    "Finding 3",
    "Finding 4",
    "Finding 5"
  ],
  "moneyLeaks": [
    {
      "title": "Short name for the leak",
      "description": "1-2 sentences explaining what you found and why it matters. Be specific with numbers.",
      "estimatedMonthlyCost": 0
    }
  ],
  "offPlanAnalysis": "2-3 paragraphs. Where are they off their own plan? What is the real-world impact in numbers? How far does this push their net worth goal? Be direct.",
  "actionPlan": {
    "painlessCuts": [
      { "action": "What to do", "monthlySaving": 0, "effort": "Low" }
    ],
    "behaviourChanges": [
      { "action": "What to do", "monthlySaving": 0, "effort": "Medium" }
    ],
    "bigMoves": [
      { "action": "What to do", "monthlySaving": 0, "effort": "High" }
    ]
  },
  "categoryGrades": [
    { "category": "Savings", "grade": "B", "comment": "one sentence" },
    { "category": "Investments", "grade": "A", "comment": "one sentence" },
    { "category": "Needs", "grade": "C", "comment": "one sentence" },
    { "category": "Wants", "grade": "D", "comment": "one sentence" }
  ],
  // If a category has insufficient data, set grade to "N/A" and comment to "Insufficient data for this period." Do not assign letter grades without meaningful data.
  "forwardProjection": {
    "currentTrajectory": "At your current rate, you will hit your net worth goal of X by [date/never]. One sentence on what that means.",
    "withActionPlan": "If you implement the painless cuts and behaviour changes above, you would hit your goal by [date] — X months earlier."
  },
  "closingVerdict": "2-3 sentences. The honest overall verdict. What is the single most important thing this person should do differently starting this month?"
}
Return only valid JSON. No markdown, no explanation outside the JSON.`;

    let aiContent;

    // Step 1: Claude API call via serverless function
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (!data.content?.[0]?.text) throw new Error('Bad response');
      const text = data.content[0].text;
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      aiContent = JSON.parse(clean);
    } catch {
      stopLoadingMessages();
      setLoading(false);
      setError('AI analysis unavailable. Please try again in a moment.');
      return;
    }

    // Step 2: PDF generation
    try {
      generatePDF(aiContent, reportData, currency, displayName);
      set('checkupUsage', { month: currentMonth, count: usageCount + 1 });
    } catch {
      setError('Could not generate PDF. Please try again.');
    } finally {
      stopLoadingMessages();
      setLoading(false);
    }
  };

  return (
    <>
      {/* Error notification */}
      {error && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '12px 16px', borderRadius: 10,
          background: '#fdf2f2', border: '1px solid #fecaca',
          fontSize: 13, color: '#c94040',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          maxWidth: 360,
        }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c94040', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Period Selector Modal */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
          <div style={{
            position: 'relative', zIndex: 1,
            background: '#fff', borderRadius: 16, padding: '32px',
            maxWidth: 500, width: '90%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          }}>
            <p style={{ fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1714', marginBottom: 6, fontWeight: 500 }}>
              Financial Health Checkup
            </p>
            <p style={{ fontSize: 13, color: '#9e9890', marginBottom: 24 }}>
              Select the period you want to analyse.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {PERIODS.map(p => {
                const isSelected = period === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    style={{
                      border: isSelected ? '2px solid #2d2a26' : '1px solid #e8e4dc',
                      borderRadius: 10, padding: '14px 16px',
                      cursor: 'pointer', background: isSelected ? '#f7f5f0' : '#fff',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1714', marginBottom: 4 }}>{p.label}</p>
                        {p.id !== 'custom' && (
                          <p style={{ fontSize: 11, color: '#9e9890' }}>{getPeriodLabel(p.id)}</p>
                        )}
                      </div>
                      {isSelected && <span style={{ fontSize: 13, color: '#1a1714', fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {period === 'custom' && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#9e9890', marginBottom: 4 }}>From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #e8e4dc', borderRadius: 8,
                      padding: '8px 10px', fontSize: 13,
                      fontFamily: 'inherit', color: '#1a1714',
                      background: '#faf9f7', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#9e9890', marginBottom: 4 }}>To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #e8e4dc', borderRadius: 8,
                      padding: '8px 10px', fontSize: 13,
                      fontFamily: 'inherit', color: '#1a1714',
                      background: '#faf9f7', outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 20, lineHeight: 1.6 }}>
              Your data is sent to Claude AI for analysis only when you click Generate. Nothing is shared automatically.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: '1px solid #e8e4dc', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, cursor: 'pointer',
                  color: '#6b6660', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={period === 'custom' && (!customStart || !customEnd)}
                style={{
                  background: (period === 'custom' && (!customStart || !customEnd)) ? '#c8c4bc' : '#2d2a26',
                  border: 'none', borderRadius: 8,
                  padding: '10px 24px', fontSize: 13,
                  cursor: (period === 'custom' && (!customStart || !customEnd)) ? 'not-allowed' : 'pointer',
                  color: '#f7f5f0', fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                Generate Report →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#f7f5f0',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <style>{`@keyframes hc-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }`}</style>
          <p style={{
            fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1714',
            fontWeight: 400,
            animation: 'hc-pulse 2s ease-in-out infinite',
          }}>
            {loadingMessage}
          </p>
          <p style={{ fontSize: 13, color: '#9e9890' }}>
            This usually takes 10–15 seconds.
          </p>
        </div>
      )}
    </>
  );
}
