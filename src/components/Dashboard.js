import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, ChartTip, TypeBadge, Divider,
  CAT_COLORS, CATEGORIES, ACCOUNT_GROUPS,
  getCurrency, fmt, getGreeting, getCurrentMonthAbbr
} from '../shared';

export default function Dashboard({
  state, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  netWorth, accountsNetWorth, totalLiabilities, latestSnapshots,
  toHome, fxRates, setTab
}) {
  const currentMonth = getCurrentMonthAbbr();
  const inc = monthIncome(currentMonth);

  // Current month actuals
  const currentActuals = state.actuals[currentMonth] || {};
  const actualIncome = Number(currentActuals.income) || 0;
  const actualSavings = (Number(currentActuals.Savings) || 0) + (Number(currentActuals.Investments) || 0);
  const plannedSavings = ((allocByCat.Savings + allocByCat.Investments) / 100) * inc;
  const savingsRate = actualIncome > 0 ? ((actualSavings / actualIncome) * 100) : 0;
  const hasActualsThisMonth = currentActuals && Object.values(currentActuals).some(v => v > 0);
  const onTrack = actualSavings >= plannedSavings;

  // Plan vs Actual for current month
  const planVsActual = CATEGORIES.map(cat => {
    const planned = (allocByCat[cat] / 100) * inc;
    const actual = Number(currentActuals[cat]) || 0;
    const diff = actual - planned;
    const isGood = (cat === 'Savings' || cat === 'Investments') ? diff >= 0 : diff <= 0;
    return { cat, planned, actual, diff, isGood, hasActual: actual > 0 };
  });

  // Account balances grouped
  const accountGroups = ACCOUNT_GROUPS.map(group => {
    const accs = (state.accounts || []).filter(a => group.types.includes(a.type));
    return { ...group, accounts: accs };
  }).filter(g => g.accounts.length > 0);

  // Net worth trend chart data
  const chartData = useMemo(() => {
    return MONTHS.map(month => {
      const snap = state.accountSnapshots?.[month];
      if (!snap || !Object.values(snap).some(v => v > 0)) return { month, total: null };
      const total = (state.accounts || []).reduce((sum, acc) => {
        const v = snap[acc.id] || 0;
        const h = toHome(v, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      return { month, total: Math.round(total - totalLiabilities) };
    }).filter(d => d.total !== null);
  }, [MONTHS, state.accountSnapshots, state.accounts, toHome, totalLiabilities]);

  const displayName = (state.displayName?.trim()) || (state.userId ? state.userId.charAt(0).toUpperCase() + state.userId.slice(1).toLowerCase() : '');

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 26, fontWeight: 400, color: '#1a1714', marginBottom: 2 }}>
          {getGreeting()}, {displayName} 👋
        </p>
        <p style={{ fontSize: 13, color: '#9e9890' }}>Here's your financial snapshot for {currentMonth}.</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Net Worth', value: f(netWorth, true), sub: 'assets − liabilities', dot: '#7eb5d6' },
          { label: 'Savings Rate', value: hasActualsThisMonth ? `${savingsRate.toFixed(1)}%` : '—', sub: hasActualsThisMonth ? 'actual savings / income' : 'Log actuals to see', dot: '#7ec8a0' },
          { label: 'Monthly Income', value: f(inc, true), sub: 'from plan', dot: '#b5a8d6' },
          { label: 'On Track', value: hasActualsThisMonth ? (onTrack ? '✓ Yes' : '✗ No') : '—', sub: hasActualsThisMonth ? (onTrack ? 'savings ≥ planned' : 'savings < planned') : 'Log actuals to see', dot: hasActualsThisMonth ? (onTrack ? '#7ec8a0' : '#e8a598') : '#d5d0c9' },
        ].map((k, i) => (
          <div key={i} style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.dot, opacity: 0.7 }} />
            <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>{k.label.toUpperCase()}</span></div>
            <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{k.value}</p>
            <p style={{ fontSize: 11, color: '#b0aa9f' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Account Balances Grouped */}
      {accountGroups.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <Lbl>ACCOUNT BALANCES</Lbl>
          <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Latest snapshot values</p>
          {accountGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>{group.label.toUpperCase()}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Account', 'Local Balance', `In ${state.currencyCode || 'GBP'}`].map(h => (
                      <th key={h} style={{ padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.accounts.map(acc => {
                    const localVal = latestSnapshots?.[acc.id] || 0;
                    const accCur = getCurrency(acc.currency);
                    const homeVal = toHome(localVal, acc.currency);
                    return (
                      <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: '#1a1714' }}>{acc.name}</td>
                        <td style={{ padding: '8px 10px', color: '#6b6660' }}>
                          {localVal > 0 ? `${accCur.symbol}${new Intl.NumberFormat(accCur.locale, { maximumFractionDigits: 0 }).format(localVal)}` : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 10px', color: localVal > 0 ? '#2d2a26' : '#d5d0c8', fontWeight: localVal > 0 ? 600 : 400 }}>
                          {localVal > 0 ? (homeVal !== null ? f(homeVal, true) : 'Rate unavailable') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Plan vs Actual — current month */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <Lbl>PLAN vs ACTUAL — {currentMonth.toUpperCase()}</Lbl>
        <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>How this month's spending compares to your plan</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Category', 'Planned', 'Actual', 'Difference'].map(h => (
                <th key={h} style={{ padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planVsActual.map(row => (
              <tr key={row.cat} style={{ borderBottom: '1px solid #f9f7f3' }}>
                <td style={{ padding: '8px 10px', fontWeight: 500, color: '#4a4643' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: CAT_COLORS[row.cat] }} />
                    {row.cat}
                  </div>
                </td>
                <td style={{ padding: '8px 10px', color: '#9e9890' }}>{f(row.planned, true)}</td>
                <td style={{ padding: '8px 10px', fontWeight: 500 }}>
                  {row.hasActual ? f(row.actual, true) : <span style={{ color: '#d5d0c8' }}>—</span>}
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: !row.hasActual ? '#d5d0c8' : row.isGood ? '#2d9e6b' : '#c94040' }}>
                  {!row.hasActual ? '—' : `${row.diff >= 0 ? '+' : ''}${f(row.diff, true)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Prompt to log actuals */}
      {!hasActualsThisMonth && (
        <div
          onClick={() => setTab('actuals (month)')}
          style={{
            ...s.card, marginBottom: 16, textAlign: 'center', padding: '16px',
            cursor: 'pointer', border: '1px dashed #d8d4cc', background: '#fdfcfa'
          }}
        >
          <p style={{ fontSize: 13, color: '#9e9890' }}>No actuals logged for {currentMonth} yet.</p>
          <p style={{ fontSize: 13, color: '#7eb5d6', fontWeight: 600, marginTop: 4 }}>Log this month's actuals →</p>
        </div>
      )}

      {/* Net Worth Trend Chart */}
      {chartData.length >= 2 ? (
        <div style={{ ...s.card }}>
          <Lbl>NET WORTH TREND</Lbl>
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="nwGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7ec8a0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7ec8a0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => `${currency.symbol}${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="total" name="Net Worth" stroke="#7ec8a0" fill="url(#nwGradDash)" strokeWidth={2} dot={{ fill: '#7ec8a0', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, textAlign: 'center', padding: '24px', color: '#b0aa9f', fontSize: 13 }}>
          Log account snapshots in at least 2 months to see the net worth trend here.
        </div>
      )}
    </div>
  );
}
