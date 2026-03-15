import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, ChartTip,
  ACCOUNT_GROUPS,
  getCurrency, getGreeting, getCurrentMonthAbbr
} from '../shared';

export default function Dashboard({
  state, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  netWorth, accountsNetWorth, totalLiabilities, latestSnapshots,
  toHome, setTab, selectedYear
}) {
  const currentMonth = getCurrentMonthAbbr();
  const inc = monthIncome(currentMonth);

  // Current month actuals
  const currentActuals = state.actuals[currentMonth] || {};
  const hasActualsThisMonth = Object.values(currentActuals).some(v => v > 0);

  // Year-to-date totals from all actuals logged
  const ytdSavings = MONTHS.reduce((sum, m) => sum + (Number(state.actuals[m]?.Savings) || 0), 0);
  const ytdInvested = MONTHS.reduce((sum, m) => sum + (Number(state.actuals[m]?.Investments) || 0), 0);

  // Goal card
  const goal = state.goalNetWorth || 0;
  const goalPct = goal > 0 ? Math.min((netWorth / goal) * 100, 100) : null;

  // Net worth trend chart data
  const chartData = useMemo(() => {
    return MONTHS.map(month => {
      const snap = state.accountSnapshots?.[month];
      if (!snap || !Object.values(snap).some(v => v > 0)) return null;
      const total = (state.accounts || []).reduce((sum, acc) => {
        const v = snap[acc.id] || 0;
        const h = toHome(v, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      return { month, total: Math.round(total - totalLiabilities) };
    }).filter(Boolean);
  }, [MONTHS, state.accountSnapshots, state.accounts, toHome, totalLiabilities]);

  // All accounts flattened with their group label, for single-table rendering
  const allAccountsWithGroup = useMemo(() => {
    const rows = [];
    ACCOUNT_GROUPS.forEach(group => {
      const accs = (state.accounts || []).filter(a => group.types.includes(a.type));
      if (accs.length > 0) rows.push({ type: 'group', label: group.label, accs });
    });
    return rows;
  }, [state.accounts]);

  const hasAnyAccounts = allAccountsWithGroup.length > 0;

  const displayName = (state.displayName?.trim()) ||
    (state.userId ? state.userId.charAt(0).toUpperCase() + state.userId.slice(1).toLowerCase() : '');

  const thStyle = { padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 };
  const tdStyle = { padding: '8px 10px' };

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 26, fontWeight: 400, color: '#1a1714', marginBottom: 2 }}>
          {getGreeting()}, {displayName} 👋
        </p>
        <p style={{ fontSize: 13, color: '#9e9890' }}>Here's your {selectedYear} financial overview.</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {/* Card 1: Net Worth */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#7eb5d6', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>NET WORTH</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{f(netWorth, true)}</p>
          <p style={{ fontSize: 11, color: '#b0aa9f' }}>&nbsp;</p>
        </div>

        {/* Card 2: Total Savings */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#7ec8a0', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL SAVINGS</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>
            {ytdSavings > 0 ? f(ytdSavings, true) : '—'}
          </p>
          <p style={{ fontSize: 11, color: '#b0aa9f' }}>this year so far</p>
        </div>

        {/* Card 3: Total Invested */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#b5a8d6', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL INVESTED</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>
            {ytdInvested > 0 ? f(ytdInvested, true) : '—'}
          </p>
          <p style={{ fontSize: 11, color: '#b0aa9f' }}>this year so far</p>
        </div>

        {/* Card 4: Goal */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: goalPct !== null && goalPct >= 100 ? '#7ec8a0' : '#e8a598', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>GOAL</span></div>
          {goalPct === null ? (
            <>
              <p style={{ fontSize: 19, fontWeight: 600, color: '#d5d0c8', marginBottom: 2 }}>—</p>
              <p
                onClick={() => setTab('plan')}
                style={{ fontSize: 11, color: '#7eb5d6', cursor: 'pointer', fontWeight: 600 }}
              >Set in Plan →</p>
            </>
          ) : goalPct >= 100 ? (
            <>
              <p style={{ fontSize: 19, fontWeight: 600, color: '#2d9e6b', marginBottom: 2 }}>✓ Reached</p>
              <p style={{ fontSize: 11, color: '#b0aa9f' }}>net worth target</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{goalPct.toFixed(0)}% of goal</p>
              <p style={{ fontSize: 11, color: '#b0aa9f' }}>net worth target</p>
            </>
          )}
        </div>
      </div>

      {/* Net Worth Trend Chart */}
      {chartData.length >= 2 ? (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <Lbl>NET WORTH TREND</Lbl>
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => `${currency.symbol}${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="total" name="Net Worth" stroke="#7ec8a0" strokeWidth={2} dot={{ fill: '#7ec8a0', r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, marginBottom: 16, textAlign: 'center', padding: '20px', color: '#b0aa9f', fontSize: 13, background: '#fdfcfa', border: '1px solid #f0ece4' }}>
          Net worth trend will appear once you've logged 2 months of account snapshots.
        </div>
      )}

      {/* Account Balances — single unified table */}
      {hasAnyAccounts && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <Lbl>ACCOUNT BALANCES</Lbl>
          <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Latest snapshot values</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>ACCOUNT</th>
                <th style={thStyle}>LOCAL BALANCE</th>
                <th style={thStyle}>IN {(state.currencyCode || 'GBP').toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {allAccountsWithGroup.map(group => [
                // Section divider row
                <tr key={`hdr-${group.label}`} style={{ background: '#f9f7f3' }}>
                  <td colSpan={3} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#9e9890', letterSpacing: '0.1em' }}>
                    {group.label.toUpperCase()}
                  </td>
                </tr>,
                // Account rows
                ...group.accs.map(acc => {
                  const localVal = latestSnapshots?.[acc.id] || 0;
                  const accCur = getCurrency(acc.currency);
                  const homeVal = toHome(localVal, acc.currency);
                  return (
                    <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                      <td style={{ ...tdStyle, fontWeight: 500, color: '#1a1714' }}>{acc.name}</td>
                      <td style={{ ...tdStyle, color: '#6b6660' }}>
                        {localVal > 0
                          ? `${accCur.symbol}${new Intl.NumberFormat(accCur.locale, { maximumFractionDigits: 0 }).format(localVal)}`
                          : <span style={{ color: '#d5d0c8' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: localVal > 0 ? '#2d2a26' : '#d5d0c8', fontWeight: localVal > 0 ? 600 : 400 }}>
                        {localVal > 0 ? (homeVal !== null ? f(homeVal, true) : 'Rate unavailable') : '—'}
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      )}

      {/* Prompt to log actuals */}
      {!hasActualsThisMonth && (
        <div
          onClick={() => setTab('tracker')}
          style={{
            ...s.card, textAlign: 'center', padding: '16px',
            cursor: 'pointer', border: '1px dashed #d8d4cc', background: '#fdfcfa'
          }}
        >
          <p style={{ fontSize: 13, color: '#9e9890' }}>No actuals logged for {currentMonth} yet.</p>
          <p style={{ fontSize: 13, color: '#7eb5d6', fontWeight: 600, marginTop: 4 }}>Log this month's actuals →</p>
        </div>
      )}
    </div>
  );
}
