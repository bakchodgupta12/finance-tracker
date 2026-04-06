import { useState, useMemo, useEffect, Fragment, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Sector,
} from 'recharts';
import { s, Lbl, DelBtn, Select, CURRENCIES, getCurrency, getCurrencyFlag, ALL_MONTHS, blockNonNumeric, pasteNumericOnly, fmtChart, parseExpenseDate } from '../shared';

// ── Recurring icon ────────────────────────────────────────────────────────────
const RecurringIcon = ({ active }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#5B9BD5' : '#d0ccc5'}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 23l-4-4 4-4"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

// ── Auto-suggest helper ───────────────────────────────────────────────────────
function getAutoSuggest(description, expenses) {
  if (!description || !expenses.length) return null;
  const lower = description.toLowerCase().trim();
  if (!lower || lower.length < 2) return null;

  // Exact match first
  const exact = expenses.filter(e => e.description.toLowerCase() === lower);
  if (exact.length) {
    const latest = exact.reduce((a, b) => {
      const da = parseExpenseDate(a.date), db = parseExpenseDate(b.date);
      return (db && da && db > da) ? b : a;
    });
    return { category: latest.category, paidBy: latest.paidBy, currency: latest.currency || null };
  }

  // Prefix match on first word
  const firstWord = lower.split(' ')[0];
  if (firstWord.length > 1) {
    const prefix = expenses.filter(e =>
      e.description.toLowerCase().startsWith(firstWord)
    );
    if (prefix.length) {
      const latest = prefix.reduce((a, b) => {
        const da = parseExpenseDate(a.date), db = parseExpenseDate(b.date);
        return (db && da && db > da) ? b : a;
      });
      return { category: latest.category, paidBy: latest.paidBy, currency: latest.currency || null };
    }
  }
  return null;
}

// ── Amount formatter ─────────────────────────────────────────────────────────
const formatAmount = (amount) => {
  const n = parseFloat(amount) || 0;
  return n.toFixed(2);
};

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

// "Apr 1" format for view-mode table cells — uses T00:00:00 to stay in local time
const formatExpenseDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
};

// Builds daily totals for This Month chart from scratch
function buildThisMonthDailyData(allExpenses, fxRates, homeCurrency, toHome) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const today        = now.getDate();

  const days = [];
  for (let d = 1; d <= today; d++) {
    days.push({ day: d, label: String(d), total: 0 });
  }

  (allExpenses || []).forEach(expense => {
    if (expense.isPlaceholder === true) return;
    if (!expense.date) return;
    const expDate = new Date(expense.date + 'T00:00:00');
    if (isNaN(expDate.getTime())) return;
    if (expDate.getMonth() !== currentMonth) return;
    if (expDate.getFullYear() !== currentYear) return;
    const dayOfMonth = expDate.getDate();
    const dayEntry   = days.find(d => d.day === dayOfMonth);
    if (!dayEntry) return;
    const amount = parseFloat(expense.amount) || 0;
    const converted = toHome(amount, expense.currency) ?? amount;
    dayEntry.total += converted;
  });

  return days;
}

const renderActivePayShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle} fill={fill} />
  );
};

function DateInput({ value, onChange }) {
  const hiddenRef = useRef(null);
  const displayValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatDisplayDate(value)
    : (value || '');
  const handleTextChange = (e) => {
    const raw = e.target.value;
    const parts = raw.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      onChange(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else { onChange(raw); }
  };
  const handlePickerChange = (e) => { onChange(e.target.value); };
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 0 }}>
      <input type="text" value={displayValue} onChange={handleTextChange}
        placeholder="DD-MM-YYYY"
        style={{ width: 95, background: 'transparent', border: 'none',
          borderBottom: '1px solid #e8e4dc', outline: 'none', fontSize: 13,
          color: '#1a1714', padding: '3px 0', fontFamily: 'inherit' }} />
      <button type="button" onClick={() => hiddenRef.current?.showPicker?.()}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          margin: 0, marginLeft: 2, color: '#b0aa9f', display: 'flex',
          alignItems: 'center', flexShrink: 0, lineHeight: 1 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ display: 'block', margin: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      <input ref={hiddenRef} type="date" value={value || ''} onChange={handlePickerChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
    </div>
  );
}

const PAGE_SIZE = 20;
const PM_COLORS = ['#7eb5d6','#7ec8a0','#d6a8c8','#fdba74','#a8d6c8','#d6c8a8','#f9a8d4','#b5a8d6'];

const DATE_FILTERS = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-3',     label: 'Last 3 Months' },
  { key: 'last-6',     label: 'Last 6 Months' },
  { key: 'this-year',  label: 'This Year' },
  { key: 'all',        label: 'All Time' },
  { key: 'custom',     label: 'Custom' },
];

export default function ExpenseTracker({
  state, set, f, currency, toHome, fxRates, selectedYear, MONTHS,
}) {
  const today         = new Date();
  const todayStr      = today.toISOString().split('T')[0];
  const curMonthAbbr  = ALL_MONTHS[today.getMonth()];

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(curMonthAbbr);
  const [editingId,     setEditingId]     = useState(null);
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [dateFilter,    setDateFilter]    = useState('this-month');
  const [customFrom,    setCustomFrom]    = useState('');
  const [customTo,      setCustomTo]      = useState('');
  const [suggestions,   setSuggestions]   = useState([]);
  const [showSugg,      setShowSugg]      = useState(false);
  // track which fields were auto-filled (reset on editingId change)
  const [autoFilled,    setAutoFilled]    = useState({ category: false, paidBy: false, currency: false });
  const [searchQuery,   setSearchQuery]   = useState('');
  // recurring: id of expense awaiting "remove from subscriptions?" prompt
  const [removeSubPrompt,    setRemoveSubPrompt]    = useState(null);
  // recurring: id of expense showing frequency prompt (monthly/yearly)
  const [showFrequencyPrompt, setShowFrequencyPrompt] = useState(null);
  // hover tracking for view-mode rows (to show inactive recurring icon)
  const [hoveredRowId,      setHoveredRowId]      = useState(null);
  const [activePayIndex,    setActivePayIndex]    = useState(null);
  const [showSpendTooltip,  setShowSpendTooltip]  = useState(false);

  const expenses       = state.expenses        || [];
  const categories     = state.expenseCategories || [];
  const paymentMethods = state.paymentMethods  || [];
  const homeCurrency   = state.currencyCode    || 'GBP';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toHomeAmt = exp => {
    const n = parseFloat(exp.amount) || 0;
    if (!n) return 0;
    if (exp.currency === homeCurrency) return n;
    const h = toHome(n, exp.currency);
    return h ?? n;
  };

  const getFilteredExpenses = (exps, filter, cStart, cEnd) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (filter) {
      case 'this-month':
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
      case 'last-3': {
        const cutoff = new Date(startOfToday);
        cutoff.setDate(cutoff.getDate() - 90);
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          return d && d >= cutoff && d <= startOfToday;
        });
      }
      case 'last-6': {
        const cutoff = new Date(startOfToday);
        cutoff.setDate(cutoff.getDate() - 180);
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          return d && d >= cutoff && d <= startOfToday;
        });
      }
      case 'this-year':
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          return d && d.getFullYear() === now.getFullYear() && d <= startOfToday;
        });
      case 'all':
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          return d && d <= startOfToday;
        });
      case 'custom':
        if (!cStart || !cEnd) return exps.filter(e => Boolean(e.date));
        return exps.filter(e => {
          if (!e.date) return false;
          const d = parseExpenseDate(e.date);
          const s = parseExpenseDate(cStart);
          const en = parseExpenseDate(cEnd);
          return d && s && en && d >= s && d <= en;
        });
      default:
        return exps.filter(e => Boolean(e.date));
    }
  };

  const getHighlightedMonths = (filter) => {
    const now = new Date();
    const highlighted = new Set();
    if (filter === 'this-month') {
      highlighted.add(now.getMonth());
      return highlighted;
    }
    if (filter === 'last-3') {
      for (let i = 0; i <= 2; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        highlighted.add(d.getMonth());
      }
      return highlighted;
    }
    if (filter === 'last-6') {
      for (let i = 0; i <= 5; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        highlighted.add(d.getMonth());
      }
      return highlighted;
    }
    if (filter === 'this-year') {
      for (let i = 0; i <= now.getMonth(); i++) highlighted.add(i);
      return highlighted;
    }
    if (filter === 'all') {
      expenses.forEach(e => { if (e.date) { const d = parseExpenseDate(e.date); if (d) highlighted.add(d.getMonth()); } });
      return highlighted;
    }
    return highlighted;
  };

  const filteredExpenses = useMemo(
    () => getFilteredExpenses(expenses, dateFilter, customFrom, customTo),
    [expenses, dateFilter, customFrom, customTo], // eslint-disable-line
  );

  const analyticsStats = useMemo(() => {
    const catTotals = {};
    let total = 0;
    let recurringTotal = 0;
    let recurringCount = 0;
    filteredExpenses.forEach(e => {
      const amt = toHomeAmt(e);
      total += amt;
      const cat = e.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
      if (e.recurring) {
        recurringTotal += amt;
        recurringCount++;
      }
    });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total, catTotals, count: filteredExpenses.length, topCat, recurringTotal, recurringCount };
  }, [filteredExpenses]); // eslint-disable-line

  // ── This Month daily chart — built separately from scratch ─────────────────
  const thisMonthData = useMemo(
    () => buildThisMonthDailyData(state.expenses, fxRates, state.currencyCode, toHome),
    [state.expenses, fxRates, state.currencyCode, toHome], // eslint-disable-line
  );

  const barChartData = useMemo(() => {
    // 'this-month' is handled by thisMonthData / buildThisMonthDailyData
    if (dateFilter === 'this-month') return [];
    const pad = n => String(n).padStart(2, '0');

    // Monthly grouping — group by YYYY-MM key
    const expByMonth = {};
    filteredExpenses.forEach(e => {
      if (!e.date) return;
      const d = parseExpenseDate(e.date);
      if (!d) return;
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      expByMonth[key] = (expByMonth[key] || 0) + toHomeAmt(e);
    });

    // Determine inclusive month range to display
    let startY, startM, endY, endM;
    if (dateFilter === 'last-3') {
      const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      cutoff.setDate(cutoff.getDate() - 90);
      startY = cutoff.getFullYear(); startM = cutoff.getMonth() + 1;
      endY = today.getFullYear();   endM = today.getMonth() + 1;
    } else if (dateFilter === 'last-6') {
      const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      cutoff.setDate(cutoff.getDate() - 180);
      startY = cutoff.getFullYear(); startM = cutoff.getMonth() + 1;
      endY = today.getFullYear();   endM = today.getMonth() + 1;
    } else if (dateFilter === 'this-year') {
      startY = today.getFullYear(); startM = 1;
      endY = today.getFullYear();   endM = today.getMonth() + 1;
    } else {
      // 'all' or 'custom' — span actual data range
      const keys = Object.keys(expByMonth).sort();
      if (keys.length === 0) return [];
      [startY, startM] = keys[0].split('-').map(Number);
      [endY,   endM]   = keys[keys.length - 1].split('-').map(Number);
    }

    const result = [];
    let y = startY, m = startM;
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${pad(m)}`;
      result.push({ month: ALL_MONTHS[m - 1], total: Math.round(expByMonth[key] || 0) });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result;
  }, [filteredExpenses, dateFilter]); // eslint-disable-line

  // ── Diagnostic logs — remove after verifying fix ─────────────────────────
  // Log 1: what expenses exist at all
  console.log('ALL EXPENSES:', expenses?.length, expenses?.slice(0, 3).map(e => ({
    date: e.date, amount: e.amount, currency: e.currency,
    isPlaceholder: e.isPlaceholder, description: e.description,
  })));
  // Log 2: what the analytics filter produces
  console.log('FILTERED EXPENSES:', filteredExpenses?.length, filteredExpenses);
  // Log 3: this month chart verification — total must match Total Spend summary
  console.log(
    'THIS MONTH CHART — days built:', thisMonthData.length,
    'total across all days:', thisMonthData.reduce((s, d) => s + d.total, 0),
  );
  // Log 4: what month/year is being targeted
  console.log('TARGET:', {
    selectedMonth,
    selectedMonthIndex: ALL_MONTHS.indexOf(selectedMonth),
    selectedYear,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
  });
  // ─────────────────────────────────────────────────────────────────────────

  const catChartData = useMemo(() => {
    const { catTotals, total } = analyticsStats;
    return Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name, value: Math.round(value),
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
        color: categories.find(c => c.name === name)?.color || '#b0aa9f',
      }));
  }, [analyticsStats, categories]);

  const pmChartData = useMemo(() => {
    let total = 0;
    const pmTotals = {};
    filteredExpenses.forEach(e => {
      const amt = toHomeAmt(e);
      total += amt;
      const key = e.paidBy || 'Unassigned';
      pmTotals[key] = (pmTotals[key] || 0) + amt;
    });
    return Object.entries(pmTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name, value: Math.round(value),
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: PM_COLORS[i % PM_COLORS.length],
      }));
  }, [filteredExpenses]); // eslint-disable-line

  // ── Month transaction data ────────────────────────────────────────────────
  const monthExpenses = useMemo(() => {
    const mIdx = ALL_MONTHS.indexOf(selectedMonth);
    return expenses
      .filter(e => {
        if (!e.date) return false;
        const d = parseExpenseDate(e.date);
        return d && d.getFullYear() === selectedYear && d.getMonth() === mIdx;
      })
      .sort((a, b) => {
        const da = parseExpenseDate(a.date);
        const db = parseExpenseDate(b.date);
        if (!da || !db) return 0;
        return db - da || b.id.localeCompare(a.id);
      });
  }, [expenses, selectedMonth, selectedYear]);

  // When range filter active, transaction table shows analytics-filtered set
  const tableExpenses = useMemo(() => {
    if (dateFilter === 'this-month') return monthExpenses;
    return [...filteredExpenses].sort((a, b) => {
      const da = parseExpenseDate(a.date);
      const db = parseExpenseDate(b.date);
      if (!da || !db) return 0;
      return db - da || b.id.localeCompare(a.id);
    });
  }, [dateFilter, monthExpenses, filteredExpenses]);

  const currencyBreakdown = useMemo(() =>
    filteredExpenses
      .filter(e => !e.isPlaceholder)
      .reduce((acc, e) => {
        const curr = e.currency || state.currencyCode;
        const amt = parseFloat(e.amount) || 0;
        if (!acc[curr]) acc[curr] = 0;
        acc[curr] += amt;
        return acc;
      }, {}),
  [filteredExpenses, state.currencyCode]); // eslint-disable-line

  const showBreakdown = Object.keys(currencyBreakdown).length > 1;

  const visibleExpenses = tableExpenses.slice(0, visibleCount);

  // Reset pagination when filter changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [dateFilter]); // eslint-disable-line

  const isSelectedMonthFuture = (() => {
    const yearStartMonth = state.yearStartMonth ?? 0;
    const mIdx = ALL_MONTHS.indexOf(selectedMonth);
    const calYear = mIdx >= yearStartMonth ? selectedYear : selectedYear + 1;
    return calYear > today.getFullYear() ||
      (calYear === today.getFullYear() && mIdx > today.getMonth());
  })();

  const recurringPlaceholders = useMemo(() => {
    if (!isSelectedMonthFuture) return [];
    const yearStartMonth = state.yearStartMonth ?? 0;
    const mIdx = ALL_MONTHS.indexOf(selectedMonth);
    const calYear = mIdx >= yearStartMonth ? selectedYear : selectedYear + 1;
    const monthKey = `${calYear}-${String(mIdx + 1).padStart(2, '0')}`;
    const seen = new Set();
    return expenses.filter(exp => {
      if (!exp.recurring) return false;
      if ((exp.skippedMonths || []).includes(monthKey)) return false;
      if (seen.has(exp.id)) return false;
      seen.add(exp.id);
      if (exp.recurringFrequency === 'yearly') {
        const origDate = parseExpenseDate(exp.date);
        return origDate && origDate.getMonth() === mIdx;
      }
      return true;
    }).map(exp => {
      const origDate = parseExpenseDate(exp.date);
      const maxDay = new Date(calYear, mIdx + 1, 0).getDate();
      const day = Math.min(origDate.getDate(), maxDay);
      const expectedDate = `${calYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { ...exp, _isPlaceholder: true, _expectedDate: expectedDate, _monthKey: monthKey };
    });
  }, [expenses, selectedMonth, selectedYear, isSelectedMonthFuture, state.yearStartMonth]); // eslint-disable-line

  // ── Auto-populate expenseAutoActuals ─────────────────────────────────────
  useEffect(() => {
    const autoActuals = {};
    expenses.forEach(exp => {
      if (!exp.date || !exp.amount) return;
      const parsedDate = parseExpenseDate(exp.date);
      if (!parsedDate) return;
      const mIdx = parsedDate.getMonth();
      const abbr = ALL_MONTHS[mIdx];
      const cat = categories.find(c => c.name === exp.category);
      if (!cat?.type) return;
      const amt = exp.currency === homeCurrency
        ? Number(exp.amount)
        : (() => { const h = toHome(Number(exp.amount), exp.currency); return h ?? Number(exp.amount); })();
      if (!autoActuals[abbr]) autoActuals[abbr] = {};
      const catKey = cat.type === 'Need' ? 'Needs' : 'Wants';
      autoActuals[abbr][catKey] = (autoActuals[abbr][catKey] || 0) + amt;
    });
    Object.keys(autoActuals).forEach(m => {
      if (autoActuals[m].Needs) autoActuals[m].Needs = Math.round(autoActuals[m].Needs);
      if (autoActuals[m].Wants) autoActuals[m].Wants = Math.round(autoActuals[m].Wants);
    });
    set('expenseAutoActuals', autoActuals);
  }, [expenses, categories]); // eslint-disable-line

  // ── Search results ────────────────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const lower = searchQuery.toLowerCase();
    return expenses
      .filter(e =>
        e.description?.toLowerCase().includes(lower) ||
        e.category?.toLowerCase().includes(lower)
      )
      .sort((a, b) => {
        const da = parseExpenseDate(a.date);
        const db = parseExpenseDate(b.date);
        if (!da || !db) return 0;
        return db - da;
      })
      .slice(0, 50);
  }, [expenses, searchQuery, isSearching]); // eslint-disable-line

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addExpense = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const mIdx = ALL_MONTHS.indexOf(selectedMonth);
    const dayStr = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}-${dayStr}`;
    const newExp = {
      id,
      date: defaultDate,
      description: '',
      amount: '',
      currency: homeCurrency,
      category: categories[0]?.name || '',
      paidBy: '',
      recurring: false,
      recurringFrequency: null,
      skippedMonths: [],
      confirmedMonths: [],
    };
    set('expenses', prev => [newExp, ...(prev || [])]);
    setEditingId(id);
    setAutoFilled({ category: false, paidBy: false, currency: false });
    setVisibleCount(prev => Math.max(prev, PAGE_SIZE));
  };

  const updateExp = (id, field, value) =>
    set('expenses', prev => (prev || []).map(e => e.id === id ? { ...e, [field]: value } : e));

  const deleteExp = id => {
    set('expenses', prev => (prev || []).filter(e => e.id !== id));
    if (editingId === id) { setEditingId(null); setShowSugg(false); }
  };

  const startEdit = id => {
    setEditingId(id);
    setAutoFilled({ category: false, paidBy: false, currency: false });
    setSuggestions([]);
    setShowSugg(false);
  };

  const saveRow = id => {
    const exp = (state.expenses || []).find(e => e.id === id);
    if (exp && !exp.description && !exp.amount) deleteExp(id);
    setEditingId(null);
    setShowSugg(false);
    setShowFrequencyPrompt(null);
  };

  // Sync one expense to subscriptions based on its frequency
  const syncToSubscriptions = (exp, frequency) => {
    const desc = exp.description || '';
    const amt  = Number(exp.amount) || 0;
    const isYearly  = frequency === 'yearly';
    const subLabel  = isYearly ? `${desc} (yearly)` : desc;
    const subAmount = isYearly ? amt / 12 : amt;
    set('subscriptions', prev => {
      const subs     = prev || [];
      // Remove both variants then add the correct one
      const filtered = subs.filter(s => s.label !== desc && s.label !== `${desc} (yearly)`);
      return [...filtered, { id: Date.now(), label: subLabel, amount: subAmount }];
    });
  };

  const toggleRecurring = (id) => {
    const exp = (state.expenses || []).find(e => e.id === id);
    if (!exp) return;
    if (!exp.recurring) {
      // Mark recurring, default frequency monthly, show frequency prompt
      updateExp(id, 'recurring', true);
      updateExp(id, 'recurringFrequency', 'monthly');
      setShowFrequencyPrompt(id);
      syncToSubscriptions(exp, 'monthly');
    } else {
      // Show "remove from subscriptions?" prompt
      setRemoveSubPrompt(id);
    }
  };

  const setFrequency = (id, freq) => {
    const exp = (state.expenses || []).find(e => e.id === id);
    if (!exp) return;
    updateExp(id, 'recurringFrequency', freq);
    syncToSubscriptions(exp, freq);
    setShowFrequencyPrompt(null);
  };

  const confirmRemoveSub = (id, remove) => {
    updateExp(id, 'recurring', false);
    if (remove) {
      const exp = (state.expenses || []).find(e => e.id === id);
      if (exp) {
        const desc = exp.description || '';
        set('subscriptions', prev => (prev || []).filter(
          s => s.label !== desc && s.label !== `${desc} (yearly)`
        ));
      }
    }
    setRemoveSubPrompt(null);
  };

  const confirmPlaceholder = (ph) => {
    set('expenses', prev => (prev || []).map(e =>
      e.id === ph.id
        ? { ...e, confirmedMonths: [...(e.confirmedMonths || []), ph._monthKey] }
        : e
    ));
  };

  const skipPlaceholder = (exp) => {
    set('expenses', prev => (prev || []).map(e =>
      e.id === exp.id
        ? { ...e, skippedMonths: [...(e.skippedMonths || []), exp._monthKey] }
        : e
    ));
  };

  // ── Description auto-suggest ─────────────────────────────────────────────
  const handleDescChange = (id, value) => {
    updateExp(id, 'description', value);
    const others = expenses.filter(e => e.id !== id);

    // Background auto-fill category + paidBy + currency
    const suggest = getAutoSuggest(value, others);
    if (suggest && value.trim()) {
      updateExp(id, 'category', suggest.category);
      updateExp(id, 'paidBy',   suggest.paidBy);
      if (suggest.currency) updateExp(id, 'currency', suggest.currency);
      setAutoFilled({ category: true, paidBy: true, currency: !!suggest.currency });
    } else {
      setAutoFilled({ category: false, paidBy: false, currency: false });
    }

    // Dropdown suggestions
    if (value.trim().length > 0) {
      const lower  = value.toLowerCase();
      const unique = [...new Set(
        others
          .filter(e => e.description.toLowerCase().startsWith(lower))
          .sort((a, b) => {
            const da = parseExpenseDate(a.date), db = parseExpenseDate(b.date);
            if (!da || !db) return 0;
            return db - da;
          })
          .map(e => e.description),
      )].slice(0, 5);
      setSuggestions(unique);
      setShowSugg(unique.length > 0);
    } else {
      setSuggestions([]);
      setShowSugg(false);
    }
  };

  const selectSuggestion = (id, desc) => {
    updateExp(id, 'description', desc);
    const others  = expenses.filter(e => e.id !== id);
    const suggest = getAutoSuggest(desc, others);
    if (suggest) {
      updateExp(id, 'category', suggest.category);
      updateExp(id, 'paidBy',   suggest.paidBy);
      if (suggest.currency) updateExp(id, 'currency', suggest.currency);
      setAutoFilled({ category: true, paidBy: true, currency: !!suggest.currency });
    }
    setShowSugg(false);
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const thSt = {
    padding: '6px 8px', color: '#9e9890', fontSize: 10, letterSpacing: '0.08em',
    textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500, whiteSpace: 'nowrap',
  };
  const tdSt  = { padding: '6px 8px', fontSize: 13, color: '#2d2a26', verticalAlign: 'middle' };
  const recurringColStyle = {
    width: 32, minWidth: 32, maxWidth: 32,
    padding: '0 4px',
    textAlign: 'center', verticalAlign: 'middle',
    boxSizing: 'border-box',
  };
  const inpSt = { ...s.input, padding: '4px 8px', fontSize: 13 };
  const autoFillBg = '#fffbeb';

  return (
    <div>
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; width: 0; padding: 0; }`}</style>
      {/* ── Analytics Section ─────────────────────────────────────────────── */}
      <div style={{ ...s.card, marginBottom: 14 }}>
        {/* Date filter pills — always visible so summary bar always reflects active filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {DATE_FILTERS.map(df => (
            <button
              key={df.key}
              onClick={() => {
                setDateFilter(df.key);
                if (df.key === 'this-month') setSelectedMonth(curMonthAbbr);
              }}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                border: dateFilter === df.key ? '2px solid #2d2a26' : '1px solid #e8e4dc',
                background: dateFilter === df.key ? '#2d2a26' : '#fff',
                color: dateFilter === df.key ? '#fff' : '#6b6660',
                cursor: 'pointer', fontWeight: dateFilter === df.key ? 600 : 400,
              }}
            >{df.label}</button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...s.input, width: 'auto' }} />
            <span style={{ color: '#b0aa9f', fontSize: 13 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...s.input, width: 'auto' }} />
          </div>
        )}

        {/* Summary bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, color: '#9e9890', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 2, textTransform: 'uppercase' }}>TOTAL SPEND</p>
              <div
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setShowSpendTooltip(true)}
                onMouseLeave={() => setShowSpendTooltip(false)}
              >
                <span style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1a1714',
                  borderBottom: showBreakdown ? '1px dashed #d0ccc5' : 'none',
                  cursor: 'default',
                }}>
                  {f(analyticsStats.total)}
                </span>
                {showSpendTooltip && showBreakdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#fff',
                    border: '1px solid #e8e4dc',
                    borderRadius: 10,
                    padding: '10px 14px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    zIndex: 50,
                    minWidth: 200,
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: -5,
                      left: '50%',
                      transform: 'translateX(-50%) rotate(45deg)',
                      width: 8,
                      height: 8,
                      background: '#fff',
                      border: '1px solid #e8e4dc',
                      borderRight: 'none',
                      borderBottom: 'none',
                    }} />
                    <p style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      color: '#9e9890',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                    }}>
                      By Currency
                    </p>
                    {Object.entries(currencyBreakdown).map(([curr, amt]) => (
                      <div key={curr} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '3px 0',
                        borderBottom: '1px solid #f9f7f3',
                        fontSize: 12,
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b6660' }}>
                          {getCurrencyFlag(curr)}
                          <span>{curr}</span>
                        </span>
                        <span style={{ fontWeight: 600, color: '#1a1714' }}>
                          {amt.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: '1px solid #e8e4dc',
                      fontSize: 12,
                    }}>
                      <span style={{ color: '#9e9890' }}>Total ({state.currencyCode})</span>
                      <span style={{ fontWeight: 700, color: '#1a1714' }}>{f(analyticsStats.total)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#9e9890', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 2, textTransform: 'uppercase' }}>TOP CATEGORY</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#1a1714' }}>{analyticsStats.topCat}</p>
            </div>
          </div>
          <button
            onClick={() => setAnalyticsOpen(prev => !prev)}
            style={{
              background: 'none', border: '1px solid #e8e4dc', borderRadius: 7,
              padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#6b6660', fontFamily: 'inherit',
            }}
          >
            {analyticsOpen ? 'Hide Charts ▲' : 'View Charts ▼'}
          </button>
        </div>

        {analyticsOpen && (
          <div style={{ marginTop: 20 }}>
            {(() => {
              const hasExpenses = filteredExpenses.length > 0;
              if (!hasExpenses) return (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9e9890', fontSize: 13 }}>
                  No spend data for the selected period. Start recording expenses to see your breakdown.
                </div>
              );
              return (
                <>
                  {/* Recurring summary line */}
                  {analyticsStats.recurringCount > 0 && (
                    <p style={{ fontSize: 12, color: '#6b6660', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <RecurringIcon active={true} />
                      Recurring this period: <strong>{f(analyticsStats.recurringTotal)}</strong> across {analyticsStats.recurringCount} item{analyticsStats.recurringCount !== 1 ? 's' : ''}
                    </p>
                  )}
                  {/* Spend trend chart */}
                  <div style={{ marginBottom: 20 }}>
                    <Lbl>SPEND TREND</Lbl>
                    <div style={{ marginTop: 10 }}>
                      {dateFilter === 'this-month' ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={thisMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: '#b0aa9f', fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
                            <YAxis tick={{ fill: '#b0aa9f', fontSize: 11 }} axisLine={false} tickLine={false}
                              tickFormatter={v => fmtChart(v, currency.symbol)} domain={[0, 'auto']} width={55} />
                            <Tooltip
                              cursor={{ stroke: '#e8e4dc', strokeWidth: 1, strokeDasharray: '4 4' }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const val = payload[0]?.value ?? 0;
                                const monthName = new Date().toLocaleString('default', { month: 'long' });
                                return (
                                  <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <div style={{ color: '#9e9890', marginBottom: 4, fontSize: 11 }}>{monthName} {label}</div>
                                    <div style={{ fontWeight: 600, color: '#1a1714', fontSize: 13 }}>
                                      {currency.symbol}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Line type="monotone" dataKey="total" stroke="#e8a598" strokeWidth={2} dot={false}
                              activeDot={{ r: 4, fill: '#e8a598', stroke: '#fff', strokeWidth: 2 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height={140}>
                          <LineChart data={barChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                            <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                            <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => fmtChart(v, currency.symbol)} />
                            <Tooltip
                              formatter={val => [fmtChart(val, currency.symbol), 'Spend']}
                              labelStyle={{ color: '#2d2a26', fontSize: 12 }}
                              contentStyle={{ border: '1px solid #e8e4dc', borderRadius: 8, fontSize: 12 }}
                            />
                            <Line type="monotone" dataKey="total" stroke="#e8a598" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#e8a598' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {(() => {
                    const categoryData = Object.entries(
                      filteredExpenses
                        .filter(e => !e.isPlaceholder && e.category)
                        .reduce((acc, e) => {
                          const cat = e.category;
                          const amt = toHomeAmt(e);
                          if (!acc[cat]) acc[cat] = 0;
                          acc[cat] += amt;
                          return acc;
                        }, {})
                    )
                      .map(([name, total]) => {
                        const catObj = state.expenseCategories?.find(c => c.name === name);
                        return { name, total, color: catObj?.color || '#e8a598' };
                      })
                      .sort((a, b) => b.total - a.total);

                    if (categoryData.length === 0) return null;

                    const grandTotal = categoryData.reduce((s, c) => s + c.total, 0);
                    const maxTotal = categoryData[0]?.total || 1;

                    return (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          color: '#9e9890',
                          textTransform: 'uppercase',
                          marginBottom: 10,
                        }}>
                          Spend by Category
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #f0ece4' }}>
                          <div style={{ width: 8, flexShrink: 0 }} />
                          <div style={{ flex: 1 }} />
                        </div>
                        {categoryData.map(cat => {
                          const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : '0.0';
                          const barPct = (cat.total / maxTotal) * 100;
                          return (
                            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f9f7f3' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                              <div style={{ width: 130, flexShrink: 0 }}>
                                <div style={{ fontSize: 13, color: '#1a1714', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                                  {cat.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, whiteSpace: 'nowrap' }}>{f(cat.total)}</span>
                                  <span style={{ color: '#d0ccc5', fontSize: 11 }}>·</span>
                                  <span style={{ fontSize: 11, color: '#9e9890', whiteSpace: 'nowrap' }}>{pct}%</span>
                                </div>
                              </div>
                              <div style={{ flex: 1, height: 10, background: '#f0ede8', borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${barPct}%`, height: '100%', background: cat.color, borderRadius: 5, transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Payment method breakdown */}
                  {pmChartData.length > 0 && !(pmChartData.length === 1 && pmChartData[0].name === 'Unassigned') && (
                    <div style={{ marginTop: 4 }}>
                      <Lbl>SPEND BY PAYMENT METHOD</Lbl>
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 20, marginTop: 10 }}>
                        <div style={{ width: '50%', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'hidden' }}>
                          <PieChart width={260} height={260}>
                            <Pie
                              data={pmChartData} cx={124} cy={124}
                              innerRadius={62} outerRadius={112} paddingAngle={2} dataKey="value"
                              activeIndex={activePayIndex}
                              activeShape={renderActivePayShape}
                              onMouseEnter={(_, index) => setActivePayIndex(index)}
                              onMouseLeave={() => setActivePayIndex(null)}
                            >
                              {pmChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const entry = payload[0].payload;
                                return (
                                  <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                                      <span style={{ fontWeight: 600, color: '#1a1714', fontSize: 13 }}>{entry.name}</span>
                                    </div>
                                    <div style={{ color: '#6b6660' }}>{currency.symbol}{entry.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    <div style={{ color: '#9e9890', marginTop: 2, fontSize: 11 }}>{entry.percentage?.toFixed(1)}% of total</div>
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </div>
                        <div style={{ alignSelf: 'flex-start', marginTop: 0, flex: 1 }}>
                          <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                              <tr>
                                {['Payment Method', 'Total', '%'].map(h => (
                                  <th key={h} style={thSt}>{h.toUpperCase()}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pmChartData.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f9f7f3' }}>
                                  <td style={tdSt}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, display: 'inline-block', flexShrink: 0 }} />
                                      {row.name}
                                    </span>
                                  </td>
                                  <td style={tdSt}>{f(row.value)}</td>
                                  <td style={{ ...tdSt, color: '#9e9890' }}>{row.pct}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Transaction Log ───────────────────────────────────────────────── */}
      <div style={s.card}>
        {/* Search bar */}
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search expenses by description or category…"
            style={{ ...s.input, paddingLeft: 36 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#b0aa9f', fontSize: 14 }}>🔍</span>
          {isSearching && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#b0aa9f', fontSize: 16, lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {/* Month pills (hidden while searching) */}
        {!isSearching && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
            {(() => {
              const highlightedMonths = getHighlightedMonths(dateFilter);
              return MONTHS.map(m => {
                const calIdx = ALL_MONTHS.indexOf(m);
                const isSelected = m === selectedMonth && dateFilter === 'this-month';
                const isInRange = highlightedMonths.has(calIdx) && dateFilter !== 'this-month';
                return (
                  <button
                    key={m}
                    onClick={() => { setSelectedMonth(m); setDateFilter('this-month'); setVisibleCount(PAGE_SIZE); }}
                    style={{
                      padding: '5px 11px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                      background: isSelected ? '#1a1714' : isInRange ? '#e8f0f7' : 'transparent',
                      color: isSelected ? '#fff' : isInRange ? '#5B9BD5' : '#6b6660',
                      border: isSelected ? '1px solid #1a1714' : isInRange ? '1px solid #c5ddf0' : '1px solid #e8e4dc',
                      cursor: 'pointer',
                      fontWeight: (isSelected || isInRange) ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >{m}</button>
                );
              });
            })()}
          </div>
        )}

        {/* Add button (hidden while searching) */}
        {!isSearching && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={addExpense} style={{
              background: '#2d2a26', color: '#f7f5f0', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>+ Add Expense</button>
          </div>
        )}

        {/* Search results */}
        {isSearching && (
          <div>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 10 }}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
            {searchResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#b0aa9f', fontSize: 13, background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc' }}>
                No expenses match your search.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>{['Date', 'Description', 'Amount', 'Currency', 'Category', ''].map(h => (
                      <th key={h} style={thSt}>{h.toUpperCase()}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {searchResults.map(exp => {
                      const accCur = getCurrency(exp.currency);
                      const flag = getCurrencyFlag(exp.currency);
                      const catColor = categories.find(c => c.name === exp.category)?.color || '#b0aa9f';
                      return (
                        <tr key={exp.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                          <td style={tdSt}>{formatExpenseDisplayDate(exp.date)}</td>
                          <td style={{ ...tdSt, fontWeight: 500 }}>{exp.description || <span style={{ color: '#d5d0c8' }}>—</span>}</td>
                          <td style={{ ...tdSt, fontWeight: 600, textAlign: 'right' }}>
                            {exp.amount ? `${accCur.symbol}${formatAmount(exp.amount)}` : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, color: '#9e9890' }}>
                            {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{exp.currency}
                          </td>
                          <td style={tdSt}>
                            {exp.category
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, display: 'inline-block', flexShrink: 0 }} />
                                  {exp.category}
                                </span>
                              : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isSearching && (tableExpenses.length === 0 && (dateFilter !== 'this-month' || recurringPlaceholders.length === 0) ? (
          <div style={{
            textAlign: 'center', padding: '28px 20px', color: '#b0aa9f', fontSize: 13,
            background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc',
          }}>
            {dateFilter === 'this-month'
              ? `No expenses logged for ${selectedMonth}. Click '+ Add Expense' to get started.`
              : 'No expenses for the selected period.'}
          </div>
        ) : (
          <>
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 110 }} />
                  <col style={{ width: 16 }} />
                  <col />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 16 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 32 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thSt}>DATE</th>
                    <th style={{ width: 16, padding: 0, border: 'none' }} />
                    <th style={{ ...thSt, paddingLeft: 0 }}>DESCRIPTION</th>
                    <th style={{ ...thSt, paddingLeft: 0, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ width: 16, padding: 0, border: 'none' }} />
                    <th style={{ ...thSt, paddingLeft: 0 }}>CURRENCY</th>
                    <th style={{ ...thSt, paddingLeft: 0 }}>CATEGORY</th>
                    <th style={{ ...thSt, paddingLeft: 0 }}>PAID BY</th>
                    <th style={{ ...thSt, ...recurringColStyle, borderBottom: '1px solid #f0ece4' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <RecurringIcon active={false} />
                      </div>
                    </th>
                    <th style={{ ...thSt, paddingLeft: 0 }} />
                  </tr>
                </thead>
                <tbody>
                  {dateFilter === 'this-month' && recurringPlaceholders.map(ph => {
                    const isConfirmed = (ph.confirmedMonths || []).includes(ph._monthKey);
                    const phFlag = getCurrencyFlag(ph.currency);
                    const catColor = categories.find(c => c.name === ph.category)?.color || '#b0aa9f';
                    return (
                      <tr key={`ph-${ph.id}`} style={{ borderBottom: '1px solid #f0ece4', opacity: isConfirmed ? 1 : 0.5, background: isConfirmed ? '' : '#f9f7f3' }}>
                        <td style={tdSt}>{formatExpenseDisplayDate(ph._expectedDate)}</td>
                        <td style={{ width: 16, padding: 0, border: 'none' }} />
                        <td style={{ ...tdSt, paddingLeft: 0, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }}>
                          {ph.description || <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, paddingLeft: 0, fontWeight: 600, textAlign: 'right' }}>
                          {ph.amount ? formatAmount(ph.amount) : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ width: 16, padding: 0, border: 'none' }} />
                        <td style={{ ...tdSt, paddingLeft: 0, color: '#9e9890' }}>
                          {phFlag && <span style={{ marginRight: 3 }}>{phFlag}</span>}{ph.currency}
                        </td>
                        <td style={{ ...tdSt, paddingLeft: 0 }}>
                          {ph.category
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, display: 'inline-block', flexShrink: 0 }} />
                                {ph.category}
                              </span>
                            : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, paddingLeft: 0, color: '#9e9890' }}>
                          {ph.paidBy || <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={recurringColStyle}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <RecurringIcon active={true} />
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', width: 110 }}>
                          {isConfirmed ? (
                            <DelBtn onClick={() => skipPlaceholder(ph)} />
                          ) : (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                onClick={() => confirmPlaceholder(ph)}
                                style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid #6dbb8a', background: 'transparent', color: '#6dbb8a', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                              >✓</button>
                              <button
                                onClick={() => skipPlaceholder(ph)}
                                style={{ padding: '2px 8px', borderRadius: 5, border: '1px solid #e8e4dc', background: 'transparent', color: '#9e9890', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                              >✕</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleExpenses.map(exp => {
                    const isEditing = editingId === exp.id;

                    if (isEditing) {
                      return (
                        <Fragment key={exp.id}>
                        <tr
                          style={{ background: '#fdfcfa', borderBottom: '1px solid #f0ece4' }}
                          onBlur={e => {
                            if (!e.currentTarget.contains(e.relatedTarget)) saveRow(exp.id);
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: '5px 8px' }}>
                            <DateInput value={exp.date} onChange={v => updateExp(exp.id, 'date', v)} />
                          </td>
                          {/* Spacer */}
                          <td style={{ width: 16, padding: 0, border: 'none' }} />
                          {/* Description + dropdown */}
                          <td style={{ padding: '5px 0 5px 0', position: 'relative' }}>
                            <input
                              type="text" value={exp.description}
                              autoFocus
                              placeholder="Description"
                              onChange={e => handleDescChange(exp.id, e.target.value)}
                              onFocus={() => { if (exp.description) handleDescChange(exp.id, exp.description); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveRow(exp.id);
                                if (e.key === 'Escape') setShowSugg(false);
                              }}
                              style={{ ...inpSt, width: '100%' }}
                            />
                            {showSugg && suggestions.length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                background: '#fff', border: '1px solid #e8e4dc', borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden',
                              }}>
                                {suggestions.map((desc, i) => (
                                  <div
                                    key={i}
                                    onMouseDown={e => { e.preventDefault(); selectSuggestion(exp.id, desc); }}
                                    style={{
                                      padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#2d2a26',
                                      borderBottom: i < suggestions.length - 1 ? '1px solid #f0ece4' : 'none',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f9f7f3'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                                  >{desc}</div>
                                ))}
                              </div>
                            )}
                          </td>
                          {/* Amount */}
                          <td style={{ padding: '5px 0' }}>
                            <input
                              type="number" min={0} value={exp.amount} placeholder="0"
                              onChange={e => updateExp(exp.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              onKeyDown={blockNonNumeric}
                              onPaste={pasteNumericOnly}
                              style={{ ...inpSt, width: '100%', textAlign: 'right' }}
                            />
                          </td>
                          {/* Amount-Currency spacer */}
                          <td style={{ width: 16, padding: 0, border: 'none' }} />
                          {/* Currency */}
                          <td style={{ padding: '5px 0' }}>
                            <Select
                              value={exp.currency}
                              onChange={e => { updateExp(exp.id, 'currency', e.target.value); setAutoFilled(p => ({ ...p, currency: false })); }}
                              style={{ fontSize: 13, padding: '4px 8px', background: autoFilled.currency ? autoFillBg : undefined }}
                            >
                              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </Select>
                          </td>
                          {/* Category */}
                          <td style={{ padding: '5px 0' }}>
                            <Select
                              value={exp.category}
                              onChange={e => { updateExp(exp.id, 'category', e.target.value); setAutoFilled(p => ({ ...p, category: false })); }}
                              style={{ fontSize: 13, padding: '4px 8px', background: autoFilled.category ? autoFillBg : undefined }}
                            >
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              {/* keep stale value if category was deleted */}
                              {exp.category && !categories.find(c => c.name === exp.category) && (
                                <option value={exp.category}>{exp.category}</option>
                              )}
                            </Select>
                            {/* Inline Need/Want prompt for unclassified categories */}
                            {(() => {
                              const cat = categories.find(c => c.name === exp.category);
                              if (!cat || cat.type !== null) return null;
                              return (
                                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 10, color: '#b0aa9f' }}>Need or Want?</span>
                                  {['Need', 'Want'].map(t => (
                                    <button key={t} onMouseDown={e => {
                                      e.preventDefault();
                                      set('expenseCategories', prev => prev.map(c => c.id === cat.id ? { ...c, type: t } : c));
                                    }} style={{
                                      fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                                      background: 'none', border: '1px solid #e8e4dc', color: '#6b6660',
                                    }}>{t}</button>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          {/* Paid By */}
                          <td style={{ padding: '5px 0' }}>
                            <Select
                              value={exp.paidBy}
                              onChange={e => { updateExp(exp.id, 'paidBy', e.target.value); setAutoFilled(p => ({ ...p, paidBy: false })); }}
                              style={{ fontSize: 13, padding: '4px 8px', background: autoFilled.paidBy ? autoFillBg : undefined }}
                            >
                              <option value="">—</option>
                              {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                            </Select>
                          </td>
                          {/* Recurring toggle (edit mode) */}
                          <td style={recurringColStyle}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                              <button
                                onMouseDown={e => { e.preventDefault(); toggleRecurring(exp.id); }}
                                title={exp.recurring ? 'Mark non-recurring' : 'Mark recurring'}
                                style={{
                                  background: exp.recurring ? '#ebf4fb' : 'none',
                                  border: 'none',
                                  borderRadius: '50%', width: 26, height: 26,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0,
                                }}
                              ><RecurringIcon active={exp.recurring} /></button>
                            </div>
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                        {/* Frequency prompt row */}
                        {showFrequencyPrompt === exp.id && (
                          <tr style={{ background: '#fdfcfa', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={10} style={{ padding: '4px 8px 10px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b6660' }}>
                                <span>How often?</span>
                                {['monthly', 'yearly'].map(freq => (
                                  <button
                                    key={freq}
                                    onMouseDown={e => { e.preventDefault(); setFrequency(exp.id, freq); }}
                                    style={{
                                      padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc',
                                      background: (exp.recurringFrequency || 'monthly') === freq ? '#5B9BD5' : 'transparent',
                                      color: (exp.recurringFrequency || 'monthly') === freq ? '#fff' : '#6b6660',
                                      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                  >{freq.charAt(0).toUpperCase() + freq.slice(1)}</button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Remove sub prompt row */}
                        {removeSubPrompt === exp.id && (
                          <tr style={{ background: '#f9f7f3', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={10} style={{ padding: '6px 12px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#6b6660' }}>
                                <span>Remove from Subscriptions too?</span>
                                <button onMouseDown={e => { e.preventDefault(); confirmRemoveSub(exp.id, true); }} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#c94040' }}>Yes, remove</button>
                                <button onMouseDown={e => { e.preventDefault(); confirmRemoveSub(exp.id, false); }} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6b6660' }}>Keep it</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    }

                    // ── Read-only row ──
                    const accCur   = getCurrency(exp.currency);
                    const flag     = getCurrencyFlag(exp.currency);
                    const catColor = categories.find(c => c.name === exp.category)?.color || '#b0aa9f';
                    return (
                      <Fragment key={exp.id}>
                        <tr
                          onClick={() => startEdit(exp.id)}
                          style={{ borderBottom: '1px solid #f9f7f3', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fdfcfa'; setHoveredRowId(exp.id); }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; setHoveredRowId(null); }}
                        >
                          <td style={tdSt}>{formatExpenseDisplayDate(exp.date)}</td>
                          <td style={{ width: 16, padding: 0, border: 'none' }} />
                          <td style={{ ...tdSt, paddingLeft: 0, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }}>
                            {exp.description || <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, paddingLeft: 0, fontWeight: 600, textAlign: 'right' }}>
                            {exp.amount
                              ? formatAmount(exp.amount)
                              : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ width: 16, padding: 0, border: 'none' }} />
                          <td style={{ ...tdSt, paddingLeft: 0, color: '#9e9890' }}>
                            {flag && <span style={{ marginRight: 3 }}>{flag}</span>}{exp.currency}
                          </td>
                          <td style={{ ...tdSt, paddingLeft: 0 }}>
                            {exp.category
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, display: 'inline-block', flexShrink: 0 }} />
                                  {exp.category}
                                </span>
                              : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, paddingLeft: 0, color: '#9e9890' }}>
                            {exp.paidBy || <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          {/* Recurring toggle (view mode) */}
                          <td style={recurringColStyle} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                              <button
                                onClick={() => toggleRecurring(exp.id)}
                                title={exp.recurring ? 'Mark non-recurring' : 'Mark recurring'}
                                style={{
                                  background: exp.recurring ? '#ebf4fb' : 'none',
                                  border: 'none', borderRadius: '50%', width: 26, height: 26,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0,
                                  opacity: exp.recurring ? 1 : (hoveredRowId === exp.id ? 1 : 0),
                                  transition: 'opacity 0.15s',
                                }}
                              ><RecurringIcon active={exp.recurring} /></button>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                        {/* Remove sub prompt row */}
                        {removeSubPrompt === exp.id && (
                          <tr style={{ background: '#f9f7f3', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={10} style={{ padding: '6px 12px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#6b6660' }}>
                                <span>Remove from Subscriptions too?</span>
                                <button onClick={() => confirmRemoveSub(exp.id, true)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#c94040' }}>Yes, remove</button>
                                <button onClick={() => confirmRemoveSub(exp.id, false)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6b6660' }}>Keep it</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Frequency prompt row */}
                        {showFrequencyPrompt === exp.id && (
                          <tr style={{ background: '#fdfcfa', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={10} style={{ padding: '4px 8px 10px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b6660' }}>
                                <span>How often?</span>
                                {['monthly', 'yearly'].map(freq => (
                                  <button
                                    key={freq}
                                    onClick={() => setFrequency(exp.id, freq)}
                                    style={{
                                      padding: '3px 10px', borderRadius: 6, border: '1px solid #e8e4dc',
                                      background: (exp.recurringFrequency || 'monthly') === freq ? '#5B9BD5' : 'transparent',
                                      color: (exp.recurringFrequency || 'monthly') === freq ? '#fff' : '#6b6660',
                                      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                  >{freq.charAt(0).toUpperCase() + freq.slice(1)}</button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state when only placeholders exist */}
            {dateFilter === 'this-month' && monthExpenses.length === 0 && recurringPlaceholders.length > 0 && (
              <div style={{ textAlign: 'center', padding: '16px 20px', color: '#b0aa9f', fontSize: 13, background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc', marginTop: 8 }}>
                No expenses logged yet. {recurringPlaceholders.length} recurring expense{recurringPlaceholders.length !== 1 ? 's' : ''} expected this month — confirm them above when ready.
              </div>
            )}

            {/* Pagination */}
            {tableExpenses.length > visibleCount && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 6 }}>
                  Showing {Math.min(visibleCount, tableExpenses.length)} of {tableExpenses.length}
                </p>
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  style={{
                    fontSize: 12, background: 'transparent', border: '1px solid #e8e4dc',
                    borderRadius: 7, padding: '5px 14px', cursor: 'pointer', color: '#6b6660', fontFamily: 'inherit',
                  }}
                >Show more</button>
              </div>
            )}

          </>
        ))}
      </div>
    </div>
  );
}
