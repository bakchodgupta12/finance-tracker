import { useState, useMemo, useEffect, Fragment } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { s, Lbl, DelBtn, Select, CURRENCIES, getCurrency, getCurrencyFlag, ALL_MONTHS, blockNonNumeric, pasteNumericOnly, fmtChart } from '../shared';

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
  if (!lower) return null;

  // Exact match first
  const exact = expenses.filter(e => e.description.toLowerCase() === lower);
  if (exact.length) {
    const latest = exact.reduce((a, b) => (a.date > b.date ? a : b));
    return { category: latest.category, paidBy: latest.paidBy };
  }

  // Prefix match on first word
  const firstWord = lower.split(' ')[0];
  if (firstWord.length > 1) {
    const prefix = expenses.filter(e =>
      e.description.toLowerCase().startsWith(firstWord)
    );
    if (prefix.length) {
      const latest = prefix.reduce((a, b) => (a.date > b.date ? a : b));
      return { category: latest.category, paidBy: latest.paidBy };
    }
  }
  return null;
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
  state, set, f, currency, toHome, selectedYear, MONTHS,
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
  const [autoFilled,    setAutoFilled]    = useState({ category: false, paidBy: false });
  const [searchQuery,   setSearchQuery]   = useState('');
  // recurring: id of expense awaiting "remove from subscriptions?" prompt
  const [removeSubPrompt,    setRemoveSubPrompt]    = useState(null);
  // recurring: id of expense showing frequency prompt (monthly/yearly)
  const [showFrequencyPrompt, setShowFrequencyPrompt] = useState(null);
  // hover tracking for view-mode rows (to show inactive recurring icon)
  const [hoveredRowId, setHoveredRowId] = useState(null);

  const expenses       = state.expenses        || [];
  const categories     = state.expenseCategories || [];
  const paymentMethods = state.paymentMethods  || [];
  const homeCurrency   = state.currencyCode    || 'GBP';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toHomeAmt = exp => {
    if (!exp.amount) return 0;
    if (exp.currency === homeCurrency) return Number(exp.amount);
    const h = toHome(Number(exp.amount), exp.currency);
    return h ?? Number(exp.amount);
  };

  const getFilterRange = () => {
    if (dateFilter === 'this-month') {
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      return { from, to: todayStr };
    }
    if (dateFilter === 'last-3') {
      const d = new Date(today); d.setMonth(d.getMonth() - 3);
      return { from: d.toISOString().split('T')[0], to: todayStr };
    }
    if (dateFilter === 'last-6') {
      const d = new Date(today); d.setMonth(d.getMonth() - 6);
      return { from: d.toISOString().split('T')[0], to: todayStr };
    }
    if (dateFilter === 'this-year') {
      return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    }
    if (dateFilter === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return { from: '2000-01-01', to: '9999-12-31' };
  };

  // ── Analytics data ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    const { from, to } = getFilterRange();
    return expenses.filter(e => e.date >= from && e.date <= to);
  }, [expenses, dateFilter, customFrom, customTo, selectedYear]); // eslint-disable-line

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

  const barChartData = useMemo(() => {
    const { from, to } = getFilterRange();
    const monthTotals = {};
    MONTHS.forEach(m => { monthTotals[m] = 0; });
    expenses.forEach(e => {
      if (e.date < from || e.date > to) return;
      const mIdx = parseInt(e.date.split('-')[1], 10) - 1;
      const abbr = ALL_MONTHS[mIdx];
      if (abbr in monthTotals) monthTotals[abbr] += toHomeAmt(e);
    });
    return MONTHS
      .map(m => ({ month: m, total: Math.round(monthTotals[m] || 0) }))
      .filter(d => d.total > 0);
  }, [expenses, dateFilter, customFrom, customTo, selectedYear, MONTHS]); // eslint-disable-line

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
        color: PM_COLORS[i % PM_COLORS.length],
      }));
  }, [filteredExpenses]); // eslint-disable-line

  // ── Month transaction data ────────────────────────────────────────────────
  const monthExpenses = useMemo(() => {
    const mIdx    = ALL_MONTHS.indexOf(selectedMonth);
    const prefix  = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`;
    return expenses
      .filter(e => e.date.startsWith(prefix))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [expenses, selectedMonth, selectedYear]);

  const visibleExpenses = monthExpenses.slice(0, visibleCount);

  const monthTotal = useMemo(
    () => monthExpenses.reduce((sum, e) => sum + toHomeAmt(e), 0),
    [monthExpenses], // eslint-disable-line
  );

  const monthCatTotals = useMemo(() => {
    const totals = {};
    monthExpenses.forEach(e => {
      const cat = e.category || 'Other';
      totals[cat] = (totals[cat] || 0) + toHomeAmt(e);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]); // eslint-disable-line

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
        const origDate = new Date(exp.date);
        return origDate.getMonth() === mIdx;
      }
      return true;
    }).map(exp => {
      const origDate = new Date(exp.date);
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
      const mIdx = parseInt(exp.date.split('-')[1], 10) - 1;
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
      .sort((a, b) => b.date.localeCompare(a.date))
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
    };
    set('expenses', prev => [newExp, ...(prev || [])]);
    setEditingId(id);
    setAutoFilled({ category: false, paidBy: false });
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
    setAutoFilled({ category: false, paidBy: false });
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
    const { _isPlaceholder, _expectedDate, _monthKey, ...baseExp } = ph;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set('expenses', prev => {
      const updated = (prev || []).map(e =>
        e.id === ph.id
          ? { ...e, skippedMonths: [...(e.skippedMonths || []), _monthKey] }
          : e
      );
      return [{ ...baseExp, id, date: _expectedDate, skippedMonths: [] }, ...updated];
    });
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

    // Background auto-fill category + paidBy
    const suggest = getAutoSuggest(value, others);
    if (suggest && value.trim()) {
      updateExp(id, 'category', suggest.category);
      updateExp(id, 'paidBy',   suggest.paidBy);
      setAutoFilled({ category: true, paidBy: true });
    } else {
      setAutoFilled({ category: false, paidBy: false });
    }

    // Dropdown suggestions
    if (value.trim().length > 0) {
      const lower  = value.toLowerCase();
      const unique = [...new Set(
        others
          .filter(e => e.description.toLowerCase().startsWith(lower))
          .sort((a, b) => b.date.localeCompare(a.date))
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
      setAutoFilled({ category: true, paidBy: true });
    }
    setShowSugg(false);
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const thSt = {
    padding: '6px 8px', color: '#9e9890', fontSize: 10, letterSpacing: '0.08em',
    textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500, whiteSpace: 'nowrap',
  };
  const tdSt  = { padding: '6px 8px', fontSize: 13, color: '#2d2a26', verticalAlign: 'middle' };
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
              onClick={() => setDateFilter(df.key)}
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
              <p style={{ fontSize: 10, color: '#b0aa9f', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>TOTAL SPEND</p>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#1a1714' }}>{f(analyticsStats.total)}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#b0aa9f', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>TOP CATEGORY</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#4a4643' }}>{analyticsStats.topCat}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#b0aa9f', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>TRANSACTIONS</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#4a4643' }}>{analyticsStats.count}</p>
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
            {/* Recurring summary line */}
            {analyticsStats.recurringCount > 0 && (
              <p style={{ fontSize: 12, color: '#6b6660', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
                <RecurringIcon active={true} />
                Recurring this period: <strong>{f(analyticsStats.recurringTotal)}</strong> across {analyticsStats.recurringCount} item{analyticsStats.recurringCount !== 1 ? 's' : ''}
              </p>
            )}
            {/* Monthly bar chart */}
            {barChartData.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <Lbl>MONTHLY SPEND</Lbl>
                <div style={{ marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={barChartData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                      <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                      <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => fmtChart(v, currency.symbol)} />
                      <Tooltip
                        formatter={val => [fmtChart(val, currency.symbol), 'Spend']}
                        labelStyle={{ color: '#2d2a26', fontSize: 12 }}
                        contentStyle={{ border: '1px solid #e8e4dc', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="total" fill="#e8a598" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>No spend data for the selected period.</p>
            )}

            {/* Category breakdown */}
            {catChartData.length > 0 && (
              <div style={{ marginBottom: 20 }}>
              <Lbl>SPEND BY CATEGORY</Lbl>
              <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 20, alignItems: 'start', marginTop: 10 }}>
                <PieChart width={140} height={140}>
                  <Pie data={catChartData} cx={65} cy={65} innerRadius={36} outerRadius={60} paddingAngle={2} dataKey="value">
                    {catChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['Category', 'Total', '%'].map(h => (
                        <th key={h} style={thSt}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catChartData.map((row, i) => (
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
            )}

            {/* Payment method breakdown */}
            <div style={{ marginTop: 4 }}>
              <Lbl>SPEND BY PAYMENT METHOD</Lbl>
              {pmChartData.length === 0 || (pmChartData.length === 1 && pmChartData[0].name === 'Unassigned') ? (
                <p style={{ fontSize: 12, color: '#b0aa9f', marginTop: 8 }}>
                  Add payment methods in Settings to see this breakdown.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 20, alignItems: 'start', marginTop: 10 }}>
                  <PieChart width={140} height={140}>
                    <Pie data={pmChartData} cx={65} cy={65} innerRadius={36} outerRadius={60} paddingAngle={2} dataKey="value">
                      {pmChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
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
              )}
            </div>
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
            {MONTHS.map(m => (
              <button key={m} onClick={() => { setSelectedMonth(m); setVisibleCount(PAGE_SIZE); }} style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
                border: m === selectedMonth ? '2px solid #2d2a26' : '1px solid #e8e4dc',
                background: m === selectedMonth ? '#2d2a26' : '#fff',
                color: m === selectedMonth ? '#fff' : m === curMonthAbbr ? '#7eb5d6' : '#6b6660',
                cursor: 'pointer', fontWeight: (m === selectedMonth || m === curMonthAbbr) ? 600 : 400,
              }}>{m}</button>
            ))}
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
                          <td style={tdSt}>{exp.date}</td>
                          <td style={{ ...tdSt, fontWeight: 500 }}>{exp.description || <span style={{ color: '#d5d0c8' }}>—</span>}</td>
                          <td style={{ ...tdSt, fontWeight: 600, textAlign: 'right' }}>
                            {exp.amount ? `${accCur.symbol}${Number(exp.amount).toLocaleString()}` : <span style={{ color: '#d5d0c8' }}>—</span>}
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

        {!isSearching && (monthExpenses.length === 0 && recurringPlaceholders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '28px 20px', color: '#b0aa9f', fontSize: 13,
            background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc',
          }}>
            No expenses logged for {selectedMonth}. Click '+ Add Expense' to get started.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 100 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 32 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Amount', 'Currency', 'Category', 'Paid By', 'REC', ''].map(h => (
                      <th key={h} style={{
                        ...thSt,
                        textAlign: h === 'Amount' ? 'right' : h === 'REC' ? 'center' : 'left',
                        verticalAlign: h === 'REC' ? 'middle' : undefined,
                        padding: h === 'REC' ? '8px 8px' : undefined,
                      }}>
                        {h === 'REC' ? <RecurringIcon active={false} /> : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recurringPlaceholders.map(ph => {
                    const phCur = getCurrency(ph.currency);
                    const phFlag = getCurrencyFlag(ph.currency);
                    const catColor = categories.find(c => c.name === ph.category)?.color || '#b0aa9f';
                    return (
                      <tr key={`ph-${ph.id}`} style={{ borderBottom: '1px solid #f0ece4', opacity: 0.5, background: '#f9f7f3' }}>
                        <td style={tdSt}>{ph._expectedDate}</td>
                        <td style={{ ...tdSt, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }}>
                          {ph.description || <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 600, textAlign: 'right' }}>
                          {ph.amount ? `${phCur.symbol}${Number(ph.amount).toLocaleString()}` : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, color: '#9e9890' }}>
                          {phFlag && <span style={{ marginRight: 3 }}>{phFlag}</span>}{ph.currency}
                        </td>
                        <td style={tdSt}>
                          {ph.category
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, display: 'inline-block', flexShrink: 0 }} />
                                {ph.category}
                              </span>
                            : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, color: '#9e9890' }}>
                          {ph.paidBy || <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <RecurringIcon active={true} />
                        </td>
                        <td style={{ padding: '6px 8px', width: 110 }}>
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
                          <td style={{ padding: '5px 8px', position: 'relative' }}>
                            <input
                              type="date" value={exp.date}
                              onChange={e => updateExp(exp.id, 'date', e.target.value)}
                              onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                              onBlur={e => { e.target.style.borderBottom = 'none'; }}
                              style={{
                                background: 'transparent', border: 'none', borderBottom: 'none', outline: 'none',
                                width: '100%', fontSize: 13, fontFamily: 'inherit', color: '#2d2a26',
                                padding: '4px 20px 4px 0', cursor: 'pointer',
                              }}
                            />
                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b0aa9f' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                            </span>
                          </td>
                          {/* Description + dropdown */}
                          <td style={{ padding: '5px 8px', position: 'relative' }}>
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
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              type="number" min={0} value={exp.amount} placeholder="0"
                              onChange={e => updateExp(exp.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              onKeyDown={blockNonNumeric}
                              onPaste={pasteNumericOnly}
                              style={{ ...inpSt, width: '100%', textAlign: 'right' }}
                            />
                          </td>
                          {/* Currency */}
                          <td style={{ padding: '5px 8px' }}>
                            <Select
                              value={exp.currency}
                              onChange={e => updateExp(exp.id, 'currency', e.target.value)}
                              style={{ fontSize: 13, padding: '4px 8px' }}
                            >
                              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </Select>
                          </td>
                          {/* Category */}
                          <td style={{ padding: '5px 8px' }}>
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
                          <td style={{ padding: '5px 8px' }}>
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
                          <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
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
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                        {/* Frequency prompt row */}
                        {showFrequencyPrompt === exp.id && (
                          <tr style={{ background: '#fdfcfa', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={8} style={{ padding: '4px 8px 10px 8px' }}>
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
                            <td colSpan={8} style={{ padding: '6px 12px 10px' }}>
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
                          <td style={tdSt}>{exp.date}</td>
                          <td style={{ ...tdSt, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 0 }}>
                            {exp.description || <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, fontWeight: 600, textAlign: 'right' }}>
                            {exp.amount
                              ? `${accCur.symbol}${Number(exp.amount).toLocaleString()}`
                              : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, color: '#9e9890' }}>
                            {flag && <span style={{ marginRight: 3 }}>{flag}</span>}{exp.currency}
                          </td>
                          <td style={tdSt}>
                            {exp.category
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 2, background: catColor, display: 'inline-block', flexShrink: 0 }} />
                                  {exp.category}
                                </span>
                              : <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          <td style={{ ...tdSt, color: '#9e9890' }}>
                            {exp.paidBy || <span style={{ color: '#d5d0c8' }}>—</span>}
                          </td>
                          {/* Recurring toggle (view mode) */}
                          <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
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
                          </td>
                          <td style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                        {/* Remove sub prompt row */}
                        {removeSubPrompt === exp.id && (
                          <tr style={{ background: '#f9f7f3', borderBottom: '1px solid #f0ece4' }}>
                            <td colSpan={8} style={{ padding: '6px 12px 10px' }}>
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
                            <td colSpan={8} style={{ padding: '4px 8px 10px 8px' }}>
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
            {monthExpenses.length === 0 && recurringPlaceholders.length > 0 && (
              <div style={{ textAlign: 'center', padding: '16px 20px', color: '#b0aa9f', fontSize: 13, background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc', marginTop: 8 }}>
                No expenses logged yet. {recurringPlaceholders.length} recurring expense{recurringPlaceholders.length !== 1 ? 's' : ''} expected this month — confirm them above when ready.
              </div>
            )}

            {/* Pagination */}
            {monthExpenses.length > visibleCount && (
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 6 }}>
                  Showing {Math.min(visibleCount, monthExpenses.length)} of {monthExpenses.length}
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

            {/* Monthly summary */}
            <div style={{ marginTop: 16, padding: '14px 16px', background: '#f9f7f3', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: monthTotal > 0 ? 10 : 0 }}>
                <span style={{ fontSize: 12, color: '#6b6660', fontWeight: 600 }}>Total spend this month</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>{f(monthTotal)}</span>
              </div>
              {monthTotal > 0 && monthCatTotals.length > 0 && (
                <>
                  {/* Proportional bar */}
                  <div style={{ height: 10, display: 'flex', borderRadius: 6, overflow: 'hidden', gap: 1, marginBottom: 8 }}>
                    {monthCatTotals.map(([cat, amt]) => {
                      const color = categories.find(c => c.name === cat)?.color || '#b0aa9f';
                      return (
                        <div
                          key={cat}
                          title={`${cat}: ${f(amt)} (${((amt / monthTotal) * 100).toFixed(1)}%)`}
                          style={{ width: `${(amt / monthTotal) * 100}%`, background: color, minWidth: 2 }}
                        />
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    {monthCatTotals.slice(0, 5).map(([cat, amt]) => {
                      const color = categories.find(c => c.name === cat)?.color || '#b0aa9f';
                      return (
                        <span key={cat} style={{ fontSize: 11, color: '#6b6660', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: 'inline-block' }} />
                          {cat} {f(amt)}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        ))}
      </div>
    </div>
  );
}
