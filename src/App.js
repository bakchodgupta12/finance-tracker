import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { saveData, loadData } from './supabase';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SYM = '£';
const TABS = ['overview','income','expenses','allocation','actuals','net worth'];
const CAT_COLORS = { Savings:'#7ec8a0', Investments:'#7eb5d6', Needs:'#e8a598', Wants:'#d6a8c8' };
const BENCHMARK = { Savings: 20, Investments: 10, Needs: 50, Wants: 20 };

function fmt(v = 0, compact = false) {
  const n = Number(v) || 0;
  if (compact && Math.abs(n) >= 1000) return `${SYM}${(n / 1000).toFixed(1)}k`;
  return `${SYM}${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n)}`;
}
function pct(part, total) { return total > 0 ? ((part / total) * 100).toFixed(1) : '0.0'; }

// ─────────────────────────────────────────────
// Default state
// ─────────────────────────────────────────────
const makeDefaultState = () => ({
  userId: '',
  incomeSources: [{ id: 1, label: 'Salary', amount: 3000 }],
  monthlyIncomeOverrides: {},   // { "Jan": 3800, "Mar": 4500 } — overrides base for that month
  startingBalance: 0,
  goalSavings: 10000,
  allocation: [
    { id: 1, label: 'Emergency Fund',       category: 'Savings',     pct: 10 },
    { id: 2, label: 'Investment Account',    category: 'Investments', pct: 10 },
    { id: 3, label: 'Pension / ISA',         category: 'Investments', pct: 5  },
    { id: 4, label: 'Rent / Mortgage',       category: 'Needs',       pct: 30 },
    { id: 5, label: 'Groceries',             category: 'Needs',       pct: 10 },
    { id: 6, label: 'Transport',             category: 'Needs',       pct: 5  },
    { id: 7, label: 'Subscriptions',         category: 'Wants',       pct: 2  },
    { id: 8, label: 'Dining / Entertainment',category: 'Wants',       pct: 5  },
  ],
  subscriptions: [
    { id: 1, label: 'Gym Membership',            amount: 0 },
    { id: 2, label: 'Streaming (Netflix/Spotify)',amount: 0 },
    { id: 3, label: 'Cloud Storage',             amount: 0 },
  ],
  monthlyBalances: MONTHS.map(m => ({ month: m, start: 0, end: 0, notes: '' })),
  // Actuals: { "Jan": { savings: 0, investments: 0, needs: 0, wants: 0, income: 0 } }
  actuals: {},
  // Net worth assets/liabilities
  assets: [
    { id: 1, label: 'Savings Account', amount: 0 },
    { id: 2, label: 'Investment Portfolio', amount: 0 },
    { id: 3, label: 'Property Value', amount: 0 },
  ],
  liabilities: [
    { id: 1, label: 'Mortgage Balance', amount: 0 },
    { id: 2, label: 'Credit Card', amount: 0 },
    { id: 3, label: 'Student Loan', amount: 0 },
  ],
});

// ─────────────────────────────────────────────
// Tiny UI helpers
// ─────────────────────────────────────────────
const s = {
  card: { background: '#fff', border: '1px solid #e8e4dc', borderRadius: 14, padding: '18px 20px' },
  label: { fontSize: 10, color: '#9e9890', letterSpacing: '0.12em', fontWeight: 600 },
  input: {
    background: '#f9f7f3', border: '1px solid #e8e4dc', borderRadius: 7,
    color: '#2d2a26', padding: '6px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  },
};

const Inp = ({ value, onChange, type = 'text', style = {}, placeholder = '' }) => (
  <input
    type={type} value={value} placeholder={placeholder}
    onChange={e => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
    style={{ ...s.input, ...style }}
  />
);

const Label = ({ children }) => <p style={{ ...s.label, marginBottom: 6 }}>{children}</p>;

const DelBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px', flexShrink: 0 }}>×</button>
);

const AddBtn = ({ onClick, label = '+ Add' }) => (
  <button onClick={onClick} style={{
    fontSize: 11, background: 'transparent', border: '1px dashed #d8d4cc',
    borderRadius: 7, padding: '5px 12px', cursor: 'pointer', color: '#a09890',
    marginTop: 8, width: '100%',
  }}>{label}</button>
);

const Tag = ({ label, color }) => (
  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: color + '28', color, fontWeight: 600, letterSpacing: '0.08em' }}>{label}</span>
);

const Divider = () => <div style={{ borderTop: '1px solid #f0ece4', margin: '16px 0' }} />;

const Tooltip2 = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e4dc', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', fontSize: 12 }}>
      <p style={{ color: '#9e9890', marginBottom: 5, fontSize: 10, letterSpacing: '0.1em' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#2d2a26', margin: '2px 0', fontWeight: 600 }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(makeDefaultState());
  const [tab, setTab] = useState('overview');
  const [saveStatus, setSaveStatus] = useState('');   // '', 'saving', 'saved', 'error'
  const [userIdInput, setUserIdInput] = useState('');
  const [loaded, setLoaded] = useState(false);

  const set = useCallback((key, val) =>
    setState(prev => ({ ...prev, [key]: typeof val === 'function' ? val(prev[key]) : val }))
  , []);

  // ── Auto-save debounce ──
  useEffect(() => {
    if (!loaded || !state.userId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const { error } = await saveData(state.userId, state);
      setSaveStatus(error ? 'error' : 'saved');
      if (!error) setTimeout(() => setSaveStatus(''), 2000);
    }, 1200);
    return () => clearTimeout(t);
  }, [state, loaded]);

  // ── Load data ──
  const handleLoad = async () => {
    if (!userIdInput.trim()) return;
    const { data } = await loadData(userIdInput.trim());
    if (data) {
      setState({ ...makeDefaultState(), ...data, userId: userIdInput.trim() });
    } else {
      setState(prev => ({ ...prev, userId: userIdInput.trim() }));
    }
    setLoaded(true);
  };

  // ── Derived numbers ──
  const baseMonthlyIncome = state.incomeSources.reduce((s, i) => s + i.amount, 0);

  const monthIncome = useCallback((month) =>
    state.monthlyIncomeOverrides[month] != null
      ? state.monthlyIncomeOverrides[month]
      : baseMonthlyIncome
  , [state.monthlyIncomeOverrides, baseMonthlyIncome]);

  const allocByCategory = useMemo(() => {
    const map = {};
    for (const cat of ['Savings','Investments','Needs','Wants']) {
      map[cat] = state.allocation.filter(a => a.category === cat).reduce((s, a) => s + a.pct, 0);
    }
    return map;
  }, [state.allocation]);

  const totalAllocPct = Object.values(allocByCategory).reduce((s, v) => s + v, 0);

  const projectionData = useMemo(() => {
    let bal = state.startingBalance;
    return MONTHS.map((month) => {
      const inc = monthIncome(month);
      const spent = inc * (totalAllocPct / 100);
      const net = inc - spent;
      bal += net;
      return { month, income: Math.round(inc), net: Math.round(net), balance: Math.round(bal) };
    });
  }, [state.startingBalance, monthIncome, totalAllocPct]);

  const yearEndBal = projectionData[11]?.balance ?? 0;
  const totalSaved = MONTHS.reduce((s, m) => s + (allocByCategory.Savings / 100) * monthIncome(m), 0);
  const totalInvested = MONTHS.reduce((s, m) => s + (allocByCategory.Investments / 100) * monthIncome(m), 0);

  const netWorth = state.assets.reduce((s, a) => s + a.amount, 0)
                 - state.liabilities.reduce((s, l) => s + l.amount, 0);

  // Actuals helpers
  const getActual = (month, key) => state.actuals[month]?.[key] ?? '';
  const setActual = (month, key, val) => {
    set('actuals', prev => ({
      ...prev,
      [month]: { ...(prev[month] || {}), [key]: val }
    }));
  };

  // ─────────────────────────────────────────────
  // Login gate
  // ─────────────────────────────────────────────
  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...s.card, maxWidth: 380, width: '100%', margin: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Lora, serif', fontSize: 24, color: '#1a1714', marginBottom: 6 }}>Finance Tracker</p>
          <p style={{ fontSize: 13, color: '#9e9890', marginBottom: 28 }}>Enter your name or a unique ID to load your data.</p>
          <Inp
            value={userIdInput}
            onChange={setUserIdInput}
            placeholder="e.g. alex"
            style={{ width: '100%', marginBottom: 12, fontSize: 14, padding: '9px 12px' }}
          />
          <button
            onClick={handleLoad}
            style={{
              width: '100%', background: '#2d2a26', color: '#f7f5f0', border: 'none',
              borderRadius: 8, padding: '10px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Continue →
          </button>
          <p style={{ fontSize: 11, color: '#c0bab2', marginTop: 16 }}>
            New name = new profile. Returning name = loads saved data.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Main UI
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: "'DM Sans', sans-serif", color: '#2d2a26' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid #e8e4dc', background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 500, color: '#1a1714' }}>Finance Tracker</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, color: '#b0aa9f' }}>
            {saveStatus === 'saving' && '⟳ Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
          </span>
          <span style={{ fontSize: 12, color: '#9e9890' }}>{state.userId}</span>
          <button onClick={() => { setLoaded(false); setUserIdInput(''); }} style={{ fontSize: 11, background: 'none', border: '1px solid #e8e4dc', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', color: '#9e9890' }}>Switch</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #e8e4dc', background: '#fff', padding: '0 24px', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #2d2a26' : '2px solid transparent',
            color: tab === t ? '#1a1714' : '#a09890', cursor: 'pointer', padding: '12px 16px',
            fontSize: 12, fontWeight: tab === t ? 600 : 400, textTransform: 'capitalize',
            fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>

        {/* ══════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════ */}
        {tab === 'overview' && (
          <div>
            {/* KPI row — only on overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Current Balance',   value: fmt(state.startingBalance, true), sub: 'starting point',               dot: '#7eb5d6' },
                { label: 'Projected Saved',   value: fmt(totalSaved, true),            sub: `${allocByCategory.Savings}% of income`, dot: '#7ec8a0' },
                { label: 'Projected Invested',value: fmt(totalInvested, true),         sub: `${allocByCategory.Investments}% of income`, dot: '#b5a8d6' },
                { label: 'Year-End Balance',  value: fmt(yearEndBal, true),            sub: yearEndBal >= state.goalSavings ? '✓ On track' : `Goal: ${fmt(state.goalSavings, true)}`, dot: yearEndBal >= state.goalSavings ? '#7ec8a0' : '#e8a598' },
              ].map((k, i) => (
                <div key={i} style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.dot, opacity: 0.7 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, marginTop: 4 }}>
                    <span style={{ ...s.label }}>{k.label.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{k.value}</p>
                  <p style={{ fontSize: 11, color: '#b0aa9f' }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Settings row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div style={s.card}>
                <Label>STARTING BALANCE</Label>
                <Inp type="number" value={state.startingBalance} onChange={v => set('startingBalance', v)} style={{ width: '100%' }} />
              </div>
              <div style={s.card}>
                <Label>ANNUAL SAVINGS GOAL</Label>
                <Inp type="number" value={state.goalSavings} onChange={v => set('goalSavings', v)} style={{ width: '100%' }} />
              </div>
              <div style={s.card}>
                <Label>BASE MONTHLY INCOME</Label>
                <div style={{ ...s.input, color: '#9e9890' }}>{fmt(baseMonthlyIncome)}</div>
                <p style={{ fontSize: 11, color: '#c0bab2', marginTop: 4 }}>Set in Income tab</p>
              </div>
            </div>

            {/* Balance chart */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <p style={{ ...s.label, marginBottom: 16 }}>PROJECTED BALANCE TRAJECTORY</p>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7eb5d6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#7eb5d6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                  <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                  <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => `${SYM}${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<Tooltip2 />} />
                  <Area type="monotone" dataKey="balance" name="Balance" stroke="#7eb5d6" fill="url(#g1)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Per-month income override + balance table */}
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom: 4 }}>MONTH-BY-MONTH DETAIL</p>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Override income for months with bonuses or side income. Log start/end balance to catch untracked spending.</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Month','Income (override)','Start Balance','End Balance','Difference','Notes'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((month, i) => {
                      const override = state.monthlyIncomeOverrides[month];
                      const rowBal = state.monthlyBalances[i];
                      const hasBal = rowBal.start > 0 || rowBal.end > 0;
                      const diff = hasBal ? rowBal.end - rowBal.start : null;
                      return (
                        <tr key={month} style={{ borderBottom: '1px solid #f9f7f3' }}>
                          <td style={{ padding: '6px 10px', color: '#6b6660', fontWeight: 500 }}>{month}</td>
                          <td style={{ padding: '4px 10px' }}>
                            <Inp
                              type="number"
                              value={override ?? ''}
                              placeholder={fmt(baseMonthlyIncome)}
                              onChange={v => set('monthlyIncomeOverrides', prev => {
                                const next = { ...prev };
                                if (!v) delete next[month]; else next[month] = v;
                                return next;
                              })}
                              style={{ width: 110 }}
                            />
                          </td>
                          <td style={{ padding: '4px 10px' }}>
                            <Inp type="number" value={rowBal.start || ''} onChange={v => set('monthlyBalances', prev => prev.map((r, j) => j === i ? { ...r, start: v } : r))} style={{ width: 90 }} />
                          </td>
                          <td style={{ padding: '4px 10px' }}>
                            <Inp type="number" value={rowBal.end || ''} onChange={v => set('monthlyBalances', prev => prev.map((r, j) => j === i ? { ...r, end: v } : r))} style={{ width: 90 }} />
                          </td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: diff === null ? '#d5d0c8' : diff >= 0 ? '#2d9e6b' : '#c94040' }}>
                            {diff === null ? '—' : (diff >= 0 ? '+' : '') + fmt(diff, true)}
                          </td>
                          <td style={{ padding: '4px 10px' }}>
                            <Inp value={rowBal.notes} onChange={v => set('monthlyBalances', prev => prev.map((r, j) => j === i ? { ...r, notes: v } : r))} style={{ width: 140 }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            INCOME TAB
        ══════════════════════════════════════ */}
        {tab === 'income' && (
          <div style={{ maxWidth: 560 }}>
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom: 4 }}>MONTHLY INCOME SOURCES</p>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>This is your base income. Override any month directly in the Overview tab for bonuses or side income.</p>
              {state.incomeSources.map(src => (
                <div key={src.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Inp value={src.label} onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                  <span style={{ color: '#b0aa9f', fontSize: 13 }}>{SYM}</span>
                  <Inp type="number" value={src.amount} onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                  <DelBtn onClick={() => set('incomeSources', prev => prev.filter(x => x.id !== src.id))} />
                </div>
              ))}
              <AddBtn onClick={() => set('incomeSources', prev => [...prev, { id: Date.now(), label: 'New Source', amount: 0 }])} />
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6b6660' }}>Total base monthly income</span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{fmt(baseMonthlyIncome)}</span>
              </div>
            </div>

            <div style={{ ...s.card, marginTop: 14 }}>
              <p style={{ ...s.label, marginBottom: 16 }}>WHERE IT GOES (FROM ALLOCATION)</p>
              {['Savings','Investments','Needs','Wants'].map(cat => {
                const catPct = allocByCategory[cat] || 0;
                const amt = (catPct / 100) * baseMonthlyIncome;
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[cat], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{cat}</span>
                    <span style={{ fontSize: 12, color: '#b0aa9f' }}>{catPct.toFixed(1)}%</span>
                    <span style={{ fontWeight: 600, fontSize: 13, minWidth: 80, textAlign: 'right' }}>{fmt(amt)}</span>
                  </div>
                );
              })}
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9e9890' }}>Unallocated</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#9e9890' }}>{fmt(((100 - totalAllocPct) / 100) * baseMonthlyIncome, true)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            EXPENSES TAB
        ══════════════════════════════════════ */}
        {tab === 'expenses' && (
          <div style={{ maxWidth: 560 }}>
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom: 4 }}>SUBSCRIPTIONS</p>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Fixed recurring costs each month.</p>
              {state.subscriptions.map(sub => (
                <div key={sub.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Inp value={sub.label} onChange={v => set('subscriptions', prev => prev.map(x => x.id === sub.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                  <span style={{ color: '#b0aa9f', fontSize: 13 }}>{SYM}</span>
                  <Inp type="number" value={sub.amount} onChange={v => set('subscriptions', prev => prev.map(x => x.id === sub.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                  <DelBtn onClick={() => set('subscriptions', prev => prev.filter(x => x.id !== sub.id))} />
                </div>
              ))}
              <AddBtn onClick={() => set('subscriptions', prev => [...prev, { id: Date.now(), label: 'New Subscription', amount: 0 }])} />
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#6b6660' }}>Total / month</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmt(state.subscriptions.reduce((s, x) => s + x.amount, 0))}</span>
              </div>
            </div>

            <div style={{ ...s.card, marginTop: 14 }}>
              <p style={{ ...s.label, marginBottom: 16 }}>EXPENSE CATEGORIES</p>
              {['Needs','Wants'].map(cat => {
                const items = state.allocation.filter(a => a.category === cat);
                const total = items.reduce((sum, a) => sum + (a.pct / 100) * baseMonthlyIncome, 0);
                return (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Tag label={cat} color={CAT_COLORS[cat]} />
                      <span style={{ fontSize: 12, color: '#9e9890' }}>{fmt(total, true)} / mo</span>
                    </div>
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f9f7f3', fontSize: 13 }}>
                        <span style={{ color: '#6b6660' }}>{item.label}</span>
                        <span style={{ fontWeight: 500 }}>{fmt((item.pct / 100) * baseMonthlyIncome, true)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            ALLOCATION TAB
        ══════════════════════════════════════ */}
        {tab === 'allocation' && (
          <div>
            {/* Donut + snapshot */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 20 }}>
                <PieChart width={160} height={160}>
                  <Pie
                    data={[
                      ...['Savings','Investments','Needs','Wants'].map(cat => ({ name: cat, value: allocByCategory[cat] || 0, fill: CAT_COLORS[cat] })),
                      { name: 'Unallocated', value: Math.max(0, 100 - totalAllocPct), fill: '#ede9e1' },
                    ]}
                    cx={75} cy={75} innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value"
                  >
                    {[0,1,2,3,4].map(i => <Cell key={i} />)}
                  </Pie>
                </PieChart>
                <div>
                  {['Savings','Investments','Needs','Wants'].map(cat => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: CAT_COLORS[cat] }} />
                      <span style={{ fontSize: 12, color: '#6b6660', width: 88 }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{(allocByCategory[cat] || 0).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <p style={{ ...s.label, marginBottom: 14 }}>50/30/20 BENCHMARK</p>
                {['Needs','Wants','Savings'].map(cat => {
                  const yours = (allocByCategory[cat] || 0) + (cat === 'Savings' ? (allocByCategory['Investments'] || 0) : 0);
                  const bench = cat === 'Savings' ? 20 : cat === 'Needs' ? 50 : 30;
                  const ok = cat === 'Needs' ? yours <= bench : yours >= bench;
                  return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: '#6b6660' }}>{cat}{cat === 'Savings' ? ' + Invest' : ''}</span>
                        <span style={{ color: ok ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>{yours.toFixed(0)}% <span style={{ color: '#b0aa9f', fontWeight: 400 }}>/ {bench}% benchmark</span></span>
                      </div>
                      <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(yours / bench * 100, 100)}%`, background: ok ? '#7ec8a0' : '#e8a598', borderRadius: 4, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
                {totalAllocPct > 100 && (
                  <p style={{ fontSize: 11, color: '#c94040', marginTop: 10, background: '#fdf2f2', padding: '6px 10px', borderRadius: 7 }}>
                    ⚠ Total allocated: {totalAllocPct.toFixed(1)}% — over 100%
                  </p>
                )}
              </div>
            </div>

            {/* Allocation table */}
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={s.label}>ALLOCATION RULES</p>
                <AddBtn onClick={() => set('allocation', prev => [...prev, { id: Date.now(), label: 'New Item', category: 'Wants', pct: 0 }])} label="+ Add row" />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Label','Category','% of Income','Monthly Amount',''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.allocation.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                      <td style={{ padding: '5px 10px' }}>
                        <Inp value={row.label} onChange={v => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, label: v } : x))} style={{ width: 160 }} />
                      </td>
                      <td style={{ padding: '5px 10px' }}>
                        <select
                          value={row.category}
                          onChange={e => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, category: e.target.value } : x))}
                          style={{ ...s.input, fontSize: 12 }}
                        >
                          {['Savings','Investments','Needs','Wants'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '5px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Inp type="number" value={row.pct} onChange={v => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, pct: v } : x))} style={{ width: 65, textAlign: 'right' }} />
                          <span style={{ color: '#b0aa9f' }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding: '5px 10px', fontWeight: 500, color: '#4a4643' }}>
                        {fmt((row.pct / 100) * baseMonthlyIncome, true)}
                      </td>
                      <td style={{ padding: '5px 10px' }}>
                        <DelBtn onClick={() => set('allocation', prev => prev.filter(x => x.id !== row.id))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#9e9890' }}>Total allocated</span>
                <span style={{ fontWeight: 700, color: totalAllocPct > 100 ? '#c94040' : '#1a1714' }}>{totalAllocPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            ACTUALS TAB
        ══════════════════════════════════════ */}
        {tab === 'actuals' && (
          <div>
            <div style={{ ...s.card, marginBottom: 14 }}>
              <p style={{ ...s.label, marginBottom: 4 }}>PLANNED vs ACTUAL</p>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 0 }}>Log what you actually earned and where it went each month. Green = at or better than plan. Red = over budget.</p>
            </div>

            {MONTHS.map((month, i) => {
              const inc = monthIncome(month);
              const planned = {
                Savings:     (allocByCategory.Savings     / 100) * inc,
                Investments: (allocByCategory.Investments / 100) * inc,
                Needs:       (allocByCategory.Needs       / 100) * inc,
                Wants:       (allocByCategory.Wants       / 100) * inc,
                income:      inc,
              };
              const hasActuals = state.actuals[month] && Object.values(state.actuals[month]).some(v => v > 0);
              const collapsed = !hasActuals;

              return (
                <details key={month} open={!collapsed} style={{ ...s.card, marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', listStyle: 'none', padding: '2px 0' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{month}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {hasActuals && (() => {
                        const actIncome = getActual(month, 'income') || inc;
                        const actSpend = ['Needs','Wants'].reduce((s, k) => s + (getActual(month, k) || 0), 0);
                        const planSpend = planned.Needs + planned.Wants;
                        const ok = actSpend <= planSpend * 1.05;
                        return <span style={{ fontSize: 11, color: ok ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>{ok ? '✓ On track' : '⚠ Over budget'}</span>;
                      })()}
                      <span style={{ fontSize: 11, color: '#b0aa9f' }}>{hasActuals ? 'Logged' : 'No data yet'}</span>
                    </div>
                  </summary>

                  <div style={{ marginTop: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Category','Planned','Actual','Difference'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['income','Savings','Investments','Needs','Wants'].map(key => {
                          const plan = planned[key] || 0;
                          const actual = getActual(month, key);
                          const diff = actual !== '' ? (key === 'income' ? actual - plan : actual - plan) : null;
                          const isGood = diff === null ? null : (key === 'income' || key === 'Savings' || key === 'Investments') ? diff >= 0 : diff <= 0;
                          return (
                            <tr key={key} style={{ borderBottom: '1px solid #f9f7f3' }}>
                              <td style={{ padding: '6px 10px', fontWeight: 500, color: '#4a4643', textTransform: 'capitalize' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {key !== 'income' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLORS[key] }} />}
                                  {key}
                                </div>
                              </td>
                              <td style={{ padding: '6px 10px', color: '#9e9890' }}>{fmt(plan, true)}</td>
                              <td style={{ padding: '4px 10px' }}>
                                <Inp
                                  type="number"
                                  value={actual}
                                  placeholder={fmt(plan, true)}
                                  onChange={v => setActual(month, key, v)}
                                  style={{ width: 100 }}
                                />
                              </td>
                              <td style={{ padding: '6px 10px', fontWeight: 600, color: diff === null ? '#d5d0c8' : isGood ? '#2d9e6b' : '#c94040' }}>
                                {diff === null ? '—' : (diff >= 0 ? '+' : '') + fmt(diff, true)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════
            NET WORTH TAB
        ══════════════════════════════════════ */}
        {tab === 'net worth' && (
          <div>
            {/* Net worth headline */}
            <div style={{ ...s.card, marginBottom: 16, textAlign: 'center', padding: '28px 24px' }}>
              <p style={{ ...s.label, marginBottom: 8 }}>TOTAL NET WORTH</p>
              <p style={{ fontFamily: 'Lora, serif', fontSize: 42, fontWeight: 500, color: netWorth >= 0 ? '#1a1714' : '#c94040', margin: '0 0 4px' }}>{fmt(netWorth)}</p>
              <p style={{ fontSize: 13, color: '#b0aa9f' }}>
                {fmt(state.assets.reduce((s, a) => s + a.amount, 0))} assets — {fmt(state.liabilities.reduce((s, l) => s + l.amount, 0))} liabilities
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Assets */}
              <div style={s.card}>
                <p style={{ ...s.label, marginBottom: 4 }}>ASSETS</p>
                <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Things you own / money you hold.</p>
                {state.assets.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <Inp value={a.label} onChange={v => set('assets', prev => prev.map(x => x.id === a.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                    <span style={{ color: '#b0aa9f', fontSize: 13 }}>{SYM}</span>
                    <Inp type="number" value={a.amount} onChange={v => set('assets', prev => prev.map(x => x.id === a.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                    <DelBtn onClick={() => set('assets', prev => prev.filter(x => x.id !== a.id))} />
                  </div>
                ))}
                <AddBtn onClick={() => set('assets', prev => [...prev, { id: Date.now(), label: 'New Asset', amount: 0 }])} />
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                  <span>Total assets</span>
                  <span style={{ color: '#2d9e6b' }}>{fmt(state.assets.reduce((s, a) => s + a.amount, 0))}</span>
                </div>
              </div>

              {/* Liabilities */}
              <div style={s.card}>
                <p style={{ ...s.label, marginBottom: 4 }}>LIABILITIES</p>
                <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Money you owe.</p>
                {state.liabilities.map(l => (
                  <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <Inp value={l.label} onChange={v => set('liabilities', prev => prev.map(x => x.id === l.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                    <span style={{ color: '#b0aa9f', fontSize: 13 }}>{SYM}</span>
                    <Inp type="number" value={l.amount} onChange={v => set('liabilities', prev => prev.map(x => x.id === l.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                    <DelBtn onClick={() => set('liabilities', prev => prev.filter(x => x.id !== l.id))} />
                  </div>
                ))}
                <AddBtn onClick={() => set('liabilities', prev => [...prev, { id: Date.now(), label: 'New Liability', amount: 0 }])} />
                <Divider />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                  <span>Total liabilities</span>
                  <span style={{ color: '#c94040' }}>{fmt(state.liabilities.reduce((s, l) => s + l.amount, 0))}</span>
                </div>
              </div>
            </div>

            {/* Breakdown bar */}
            <div style={{ ...s.card, marginTop: 14 }}>
              <p style={{ ...s.label, marginBottom: 14 }}>ASSET BREAKDOWN</p>
              {state.assets.map(a => {
                const totalA = state.assets.reduce((s, x) => s + x.amount, 0);
                const w = totalA > 0 ? (a.amount / totalA) * 100 : 0;
                return (
                  <div key={a.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: '#6b6660' }}>{a.label}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(a.amount, true)} <span style={{ color: '#b0aa9f', fontWeight: 400 }}>({w.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w}%`, background: '#7eb5d6', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
