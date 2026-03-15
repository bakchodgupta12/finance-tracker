import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { s, Lbl, DelBtn, CURRENCIES, getCurrency, ALL_MONTHS } from '../shared';

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
    filteredExpenses.forEach(e => {
      const amt = toHomeAmt(e);
      total += amt;
      const cat = e.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total, catTotals, count: filteredExpenses.length, topCat };
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
    padding: '6px 8px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em',
    textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500, whiteSpace: 'nowrap',
  };
  const tdSt  = { padding: '6px 8px', fontSize: 13, color: '#2d2a26', verticalAlign: 'middle' };
  const inpSt = { ...s.input, padding: '4px 8px', fontSize: 13 };
  const autoFillBg = '#fffbeb';

  return (
    <div>
      {/* ── Analytics Section ─────────────────────────────────────────────── */}
      <div style={{ ...s.card, marginBottom: 14 }}>
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
            {analyticsOpen ? 'Hide Analytics ▲' : 'View Analytics ▼'}
          </button>
        </div>

        {analyticsOpen && (
          <div style={{ marginTop: 20 }}>
            {/* Date filter pills */}
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

            {/* Monthly bar chart */}
            {barChartData.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <Lbl>MONTHLY SPEND</Lbl>
                <div style={{ marginTop: 10 }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={barChartData} barSize={24}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                      <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                      <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => `${currency.symbol}${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={val => [f(val), 'Spend']}
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
              <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 20, alignItems: 'start' }}>
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
            )}
          </div>
        )}
      </div>

      {/* ── Transaction Log ───────────────────────────────────────────────── */}
      <div style={s.card}>
        {/* Month pills */}
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

        {/* Add button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={addExpense} style={{
            background: '#2d2a26', color: '#f7f5f0', border: 'none', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>+ Add Expense</button>
        </div>

        {monthExpenses.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '28px 20px', color: '#b0aa9f', fontSize: 13,
            background: '#fdfcfa', borderRadius: 10, border: '1px dashed #e8e4dc',
          }}>
            No expenses logged for {selectedMonth}. Click '+ Add Expense' to get started.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Date', 'Description', 'Amount', 'Currency', 'Category', 'Paid By', ''].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses.map(exp => {
                    const isEditing = editingId === exp.id;

                    if (isEditing) {
                      return (
                        <tr
                          key={exp.id}
                          style={{ background: '#fdfcfa', borderBottom: '1px solid #f0ece4' }}
                          onBlur={e => {
                            if (!e.currentTarget.contains(e.relatedTarget)) saveRow(exp.id);
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              type="date" value={exp.date}
                              onChange={e => updateExp(exp.id, 'date', e.target.value)}
                              style={{ ...inpSt, width: 130 }}
                            />
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
                              style={{ ...inpSt, width: 160 }}
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
                              type="number" value={exp.amount} placeholder="0"
                              onChange={e => updateExp(exp.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              style={{ ...inpSt, width: 90, textAlign: 'right' }}
                            />
                          </td>
                          {/* Currency */}
                          <td style={{ padding: '5px 8px' }}>
                            <select
                              value={exp.currency}
                              onChange={e => updateExp(exp.id, 'currency', e.target.value)}
                              style={{ ...inpSt, width: 80 }}
                            >
                              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </select>
                          </td>
                          {/* Category */}
                          <td style={{ padding: '5px 8px' }}>
                            <select
                              value={exp.category}
                              onChange={e => { updateExp(exp.id, 'category', e.target.value); setAutoFilled(p => ({ ...p, category: false })); }}
                              style={{ ...inpSt, width: 130, background: autoFilled.category ? autoFillBg : inpSt.background }}
                            >
                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              {/* keep stale value if category was deleted */}
                              {exp.category && !categories.find(c => c.name === exp.category) && (
                                <option value={exp.category}>{exp.category}</option>
                              )}
                            </select>
                          </td>
                          {/* Paid By */}
                          <td style={{ padding: '5px 8px' }}>
                            <select
                              value={exp.paidBy}
                              onChange={e => { updateExp(exp.id, 'paidBy', e.target.value); setAutoFilled(p => ({ ...p, paidBy: false })); }}
                              style={{ ...inpSt, width: 130, background: autoFilled.paidBy ? autoFillBg : inpSt.background }}
                            >
                              <option value="">—</option>
                              {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <DelBtn onClick={() => deleteExp(exp.id)} />
                          </td>
                        </tr>
                      );
                    }

                    // ── Read-only row ──
                    const accCur   = getCurrency(exp.currency);
                    const catColor = categories.find(c => c.name === exp.category)?.color || '#b0aa9f';
                    return (
                      <tr
                        key={exp.id}
                        onClick={() => startEdit(exp.id)}
                        style={{ borderBottom: '1px solid #f9f7f3', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fdfcfa'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                      >
                        <td style={tdSt}>{exp.date}</td>
                        <td style={{ ...tdSt, fontWeight: 500 }}>
                          {exp.description || <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, fontWeight: 600, textAlign: 'right' }}>
                          {exp.amount
                            ? `${accCur.symbol}${Number(exp.amount).toLocaleString()}`
                            : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdSt, color: '#9e9890' }}>{exp.currency}</td>
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
                        <td style={{ padding: '6px 8px' }} onClick={e => e.stopPropagation()}>
                          <DelBtn onClick={() => deleteExp(exp.id)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
                          {cat} {f(amt, true)}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
