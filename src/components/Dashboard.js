import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, ChartTip,
  ACCOUNT_GROUPS, GROUP_HEADER_STYLES,
  getCurrency, getCurrencyFlag, getGreeting, getCurrentMonthAbbr, ALL_MONTHS
} from '../shared';
import HealthCheckup from './HealthCheckup';

export default function Dashboard({
  state, set, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  netWorth, accountsNetWorth, totalLiabilities, latestSnapshots,
  toHome, navigate, selectedYear
}) {
  const currentMonth = getCurrentMonthAbbr();

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
  }, [MONTHS, state.accountSnapshots, state.accounts, toHome, totalLiabilities]); // eslint-disable-line

  // Month-on-month net worth change
  const momChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const prev = chartData[chartData.length - 2].total;
    const curr = chartData[chartData.length - 1].total;
    const diff = curr - prev;
    const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
    return { diff, pct };
  }, [chartData]);

  // Latest snapshot month label
  const latestSnapMonth = useMemo(() => {
    for (let i = MONTHS.length - 1; i >= 0; i--) {
      const snap = state.accountSnapshots?.[MONTHS[i]];
      if (snap && Object.values(snap).some(v => v > 0)) return MONTHS[i];
    }
    return null;
  }, [MONTHS, state.accountSnapshots]);

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

  const [showCheckup, setShowCheckup] = useState(false);

  // Health checkup button state
  const checkupNow = new Date().toISOString().slice(0, 7);
  const checkupUsage = state.checkupUsage || { month: '', count: 0 };
  const checkupUsageCount = checkupUsage.month === checkupNow ? checkupUsage.count : 0;
  const checkupUsesRemaining = Math.max(0, 3 - checkupUsageCount);
  const checkupNextMonth = ALL_MONTHS[(new Date().getMonth() + 1) % 12];
  const checkupHasData = (state.expenses || []).length > 0 &&
    Object.values(state.accountSnapshots || {}).some(snap => snap && Object.values(snap).some(v => v > 0));

  const thStyle = { padding: '9px 12px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 };
  const tdStyle = { padding: '9px 12px' };

  // ── Getting Started Checklist ──────────────────
  const checklistItems = [
    {
      id: 'onboarded',
      label: 'Set up your account',
      done: true, // always done once logged in
      cta: null,
    },
    {
      id: 'account_added',
      label: 'Add your first account',
      done: (state.accounts || []).length > 0,
      cta: () => navigate('settings', 'accounts'),
      ctaLabel: 'Go to Accounts →',
    },
    {
      id: 'allocation_set',
      label: 'Set your budget allocation',
      done: (state.allocation || []).some(a => a.pct > 0),
      cta: () => navigate('plan'),
      ctaLabel: 'Go to Plan →',
    },
    {
      id: 'actuals_logged',
      label: 'Log your first month\'s actuals',
      done: Object.keys(state.actuals || {}).length > 0,
      cta: () => navigate('tracker', 'income'),
      ctaLabel: 'Go to Tracker →',
    },
    {
      id: 'expense_logged',
      label: 'Log your first expense',
      done: (state.expenses || []).length > 0,
      cta: () => navigate('tracker', 'expenses'),
      ctaLabel: 'Go to Expenses →',
    },
    {
      id: 'goal_set',
      label: 'Set a net worth goal',
      done: (state.goalNetWorth || 0) > 0,
      cta: () => navigate('plan', 'goals'),
      ctaLabel: 'Set a Goal →',
    },
  ];

  const allDone = checklistItems.every(i => i.done);
  const completedCount = checklistItems.filter(i => i.done).length;
  const dismissCount = state.checklistDismissCount || 0;
  const permanentlyDismissed = state.checklistPermanentlyDismissed || false;
  const showChecklist = !permanentlyDismissed && !allDone;

  const handleDismissChecklist = () => {
    const newCount = dismissCount + 1;
    if (newCount >= 4) {
      // 4th dismiss: permanently hide
      set('checklistPermanentlyDismissed');
    } else {
      set('checklistDismissCount', newCount);
    }
  };

  return (
    <div>
      {/* Greeting + Health Checkup Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ fontFamily: 'Lora, serif', fontSize: 26, fontWeight: 400, color: '#1a1714', marginBottom: 2 }}>
            {getGreeting()}, {displayName} 👋
          </p>
          <p style={{ fontSize: 13, color: '#9e9890' }}>Here's your {selectedYear} financial overview.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingTop: 4 }}>
          <div title={!checkupHasData ? 'Log at least one month of expenses and account balances to generate your checkup.' : undefined}>
            <button
              onClick={() => { if (checkupHasData && checkupUsesRemaining > 0) setShowCheckup(true); }}
              disabled={!checkupHasData || checkupUsesRemaining === 0}
              style={{
                border: `1px solid ${(!checkupHasData || checkupUsesRemaining === 0) ? '#d8d4cc' : '#2d2a26'}`,
                color: (!checkupHasData || checkupUsesRemaining === 0) ? '#b0aa9f' : '#2d2a26',
                background: 'transparent',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                cursor: (!checkupHasData || checkupUsesRemaining === 0) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: (!checkupHasData || checkupUsesRemaining === 0) ? 0.6 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (checkupHasData && checkupUsesRemaining > 0) {
                  e.currentTarget.style.background = '#2d2a26';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = (!checkupHasData || checkupUsesRemaining === 0) ? '#b0aa9f' : '#2d2a26';
              }}
            >
              📊 Financial Health Checkup
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#b0aa9f', marginTop: 5, textAlign: 'right' }}>
            {checkupUsesRemaining === 0
              ? `No uses remaining until ${checkupNextMonth}`
              : `${checkupUsesRemaining} use${checkupUsesRemaining !== 1 ? 's' : ''} remaining this month`}
          </p>
        </div>
      </div>

      {/* Getting Started Checklist */}
      {showChecklist && (
        <div style={{ ...s.card, marginBottom: 20, border: '1px solid #e8e4dc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <Lbl>GETTING STARTED</Lbl>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginTop: 2 }}>{completedCount} of {checklistItems.length} completed</p>
            </div>
            <button onClick={handleDismissChecklist} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#b0aa9f', padding: '4px 8px', borderRadius: 6,
              fontFamily: 'inherit',
            }}>
              {dismissCount >= 3 ? 'Hide permanently' : 'Dismiss'}
            </button>
          </div>
          <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              height: '100%',
              width: `${(completedCount / checklistItems.length) * 100}%`,
              background: '#7ec8a0', borderRadius: 4, transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checklistItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: item.done ? '#7ec8a0' : '#f0ece4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.done && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: item.done ? '#b0aa9f' : '#2d2a26', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.label}
                  </span>
                </div>
                {!item.done && item.cta && (
                  <button onClick={item.cta} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#7eb5d6', fontWeight: 600,
                    fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap',
                  }}>{item.ctaLabel}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {/* Card 1: Net Worth */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#7eb5d6', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>NET WORTH</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{f(netWorth)}</p>
          {momChange ? (
            <p style={{ fontSize: 11, color: momChange.diff >= 0 ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>
              {momChange.diff >= 0 ? '+' : ''}{f(momChange.diff)}
              {momChange.pct !== null && ` (${momChange.pct >= 0 ? '+' : ''}${momChange.pct.toFixed(1)}%)`} vs prev
            </p>
          ) : (
            <p style={{ fontSize: 11, color: '#b0aa9f' }}>&nbsp;</p>
          )}
        </div>

        {/* Card 2: Total Savings */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#7ec8a0', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL SAVINGS</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>
            {ytdSavings > 0 ? f(ytdSavings) : '—'}
          </p>
          <p style={{ fontSize: 11, color: '#b0aa9f' }}>this year so far</p>
        </div>

        {/* Card 3: Total Invested */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#b5a8d6', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL INVESTED</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>
            {ytdInvested > 0 ? f(ytdInvested) : '—'}
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
                onClick={() => navigate('plan', 'goals')}
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
            {(() => {
              const yFmt = v => {
                const abs = Math.abs(v);
                if (abs >= 1_000_000) return `${currency.symbol}${(abs / 1_000_000).toFixed(1)}m`;
                return `${currency.symbol}${new Intl.NumberFormat(currency.locale, { maximumFractionDigits: 0 }).format(abs)}`;
              };
              return (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={yFmt} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="total" name="Net Worth" stroke="#7ec8a0" strokeWidth={2} dot={{ fill: '#7ec8a0', r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
              );
            })()}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Lbl>ACCOUNT BALANCES</Lbl>
          </div>
          <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
            Latest snapshot{latestSnapMonth ? ` · ${latestSnapMonth} ${selectedYear}` : ''}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>ACCOUNT</th>
                <th style={thStyle}>LOCAL BALANCE</th>
                <th style={thStyle}>IN {(state.currencyCode || 'GBP').toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {allAccountsWithGroup.map(group => {
                const hdrStyle = GROUP_HEADER_STYLES[group.label] || { background: '#f9f7f3', color: '#9e9890' };
                return [
                  <tr key={`hdr-${group.label}`} style={{ background: hdrStyle.background }}>
                    <td colSpan={3} style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: hdrStyle.color, letterSpacing: '0.1em' }}>
                      {group.label.toUpperCase()}
                    </td>
                  </tr>,
                  ...group.accs.map(acc => {
                    const localVal = latestSnapshots?.[acc.id] || 0;
                    const accCur = getCurrency(acc.currency);
                    const flag = getCurrencyFlag(acc.currency);
                    const homeVal = toHome(localVal, acc.currency);
                    return (
                      <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                        <td style={{ ...tdStyle, fontWeight: 500, color: '#1a1714' }}>{acc.name}</td>
                        <td style={{ ...tdStyle, color: '#6b6660' }}>
                          {localVal > 0
                            ? <span>{flag && <span style={{ marginRight: 4 }}>{flag}</span>}{accCur.symbol}{new Intl.NumberFormat(accCur.locale, { maximumFractionDigits: 0 }).format(localVal)}</span>
                            : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: localVal > 0 ? '#2d2a26' : '#d5d0c8', fontWeight: localVal > 0 ? 600 : 400 }}>
                          {localVal > 0 ? (homeVal !== null ? f(homeVal) : 'Rate unavailable') : '—'}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      <HealthCheckup
        open={showCheckup}
        onClose={() => setShowCheckup(false)}
        state={state}
        set={set}
        f={f}
        currency={currency}
        MONTHS={MONTHS}
        allocByCat={allocByCat}
        baseIncome={baseIncome}
        toHome={toHome}
        totalLiabilities={totalLiabilities}
        selectedYear={selectedYear}
      />

      {/* Prompt to log actuals */}
      {!hasActualsThisMonth && (
        <div
          onClick={() => navigate('tracker', 'income')}
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
