import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, ChartTip, fmtChart,
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

  const dashIsPositive = chartData.length < 2 || chartData[chartData.length - 1].total >= chartData[0].total;
  const dashColor = dashIsPositive ? '#6dbb8a' : '#E8A838';
  const dashGradId = dashIsPositive ? 'dashGradPos' : 'dashGradNeg';

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
  const [expandedGroups, setExpandedGroups] = useState({});

  // Health checkup button state
  const checkupNow = new Date().toISOString().slice(0, 7);
  const checkupUsage = state.checkupUsage || { month: '', count: 0 };
  const checkupUsageCount = checkupUsage.month === checkupNow ? checkupUsage.count : 0;
  const checkupUsesRemaining = Math.max(0, 3 - checkupUsageCount);
  const checkupNextMonth = ALL_MONTHS[(new Date().getMonth() + 1) % 12];
  const checkupHasData = (state.expenses || []).length > 0 &&
    Object.values(state.accountSnapshots || {}).some(snap => snap && Object.values(snap).some(v => v > 0));


  // ── Getting Started Checklist ──────────────────

  // Permanently track which tasks have ever been completed (year-agnostic)
  const tasksDone = state.checklistTasksDone || {};
  useEffect(() => {
    const current = state.checklistTasksDone || {};
    const updates = {};
    if (!current.account_added && (state.accounts || []).length > 0) updates.account_added = true;
    if (!current.allocation_set && (state.allocation || []).some(a => a.pct > 0)) updates.allocation_set = true;
    if (!current.expense_logged && (state.expenses || []).length > 0) updates.expense_logged = true;
    if (!current.goal_set && (state.goalNetWorth || 0) > 0) updates.goal_set = true;
    if (!current.actuals_logged && (Object.keys(state.actuals || {}).length > 0 || Object.keys(state.incomeActuals || {}).length > 0)) updates.actuals_logged = true;
    if (Object.keys(updates).length > 0) {
      set('checklistTasksDone', { ...current, ...updates });
    }
  }, [state.accounts, state.allocation, state.expenses, state.goalNetWorth, state.actuals, state.incomeActuals]); // eslint-disable-line

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
      done: tasksDone.account_added || (state.accounts || []).length > 0,
      cta: () => navigate('settings', 'accounts'),
      ctaLabel: 'Go to Accounts →',
    },
    {
      id: 'allocation_set',
      label: 'Set your budget allocation',
      done: tasksDone.allocation_set || (state.allocation || []).some(a => a.pct > 0),
      cta: () => navigate('plan'),
      ctaLabel: 'Go to Plan →',
    },
    {
      id: 'actuals_logged',
      label: 'Log your first month\'s actuals',
      done: tasksDone.actuals_logged || Object.keys(state.actuals || {}).length > 0 || Object.keys(state.incomeActuals || {}).length > 0,
      cta: () => navigate('tracker', 'income'),
      ctaLabel: 'Go to Tracker →',
    },
    {
      id: 'expense_logged',
      label: 'Log your first expense',
      done: tasksDone.expense_logged || (state.expenses || []).length > 0,
      cta: () => navigate('tracker', 'expenses'),
      ctaLabel: 'Go to Expenses →',
    },
    {
      id: 'goal_set',
      label: 'Set a net worth goal',
      done: tasksDone.goal_set || (state.goalNetWorth || 0) > 0,
      cta: () => navigate('plan', 'goals'),
      ctaLabel: 'Set a Goal →',
    },
  ];

  const allDone = checklistItems.every(i => i.done);
  const completedCount = checklistItems.filter(i => i.done).length;
  const permanentlyDismissed = state.checklistPermanentlyDismissed || false;
  // Hide when permanently dismissed OR when all tasks are done (stays hidden across years
  // because checklistTasksDone persists, so allDone stays true even in a new year)
  const showChecklist = !permanentlyDismissed && !allDone;

  const handleDismissChecklist = () => {
    set('checklistPermanentlyDismissed', true);
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
              {allDone ? 'Done' : 'Dismiss'}
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

      {/* Net Worth Headline */}
      <div style={{
        marginBottom: 24,
        padding: '20px 24px',
        background: '#fff',
        border: '1px solid #e8e4dc',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#5B9BD5' }} />
        <div>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
            color: '#9e9890', marginBottom: 6, textTransform: 'uppercase',
          }}>Net Worth</p>
          <p style={{
            fontFamily: 'inherit', fontSize: 38, fontWeight: 700,
            color: '#1a1714', lineHeight: 1, letterSpacing: '-0.5px',
          }}>{f(netWorth)}</p>
        </div>
        {momChange && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#9e9890', marginBottom: 4, letterSpacing: '0.05em' }}>
              vs last month
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: momChange.diff >= 0 ? '#6dbb8a' : '#D96B6B' }}>
              {momChange.diff >= 0 ? '+' : ''}{f(momChange.diff)}
            </p>
            {momChange.pct !== null && (
              <p style={{ fontSize: 12, color: momChange.diff >= 0 ? '#6dbb8a' : '#D96B6B', marginTop: 2 }}>
                {momChange.pct >= 0 ? '+' : ''}{momChange.pct.toFixed(1)}%
              </p>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {/* Card 1: VS Last Month */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: momChange && momChange.diff >= 0 ? '#6dbb8a' : '#D96B6B', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>VS LAST MONTH</span></div>
          {momChange ? (
            <>
              <p style={{ fontSize: 19, fontWeight: 600, color: momChange.diff >= 0 ? '#2d9e6b' : '#c94040', marginBottom: 2 }}>
                {momChange.diff >= 0 ? '+' : ''}{f(momChange.diff)}
              </p>
              <p style={{ fontSize: 12, color: momChange.diff >= 0 ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>
                {momChange.pct !== null ? `${momChange.pct.toFixed(1)}% since last month` : 'since last month'}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 19, fontWeight: 600, color: '#b0aa9f', marginBottom: 2 }}>—</p>
              <p style={{ fontSize: 11, color: '#b0aa9f' }}>log 2+ months</p>
            </>
          )}
        </div>

        {/* Card 2: Total Savings */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#7ec8a0', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL SAVINGS</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: ytdSavings > 0 ? '#1a1714' : '#b0aa9f', marginBottom: 2 }}>
            {ytdSavings > 0 ? f(ytdSavings) : '—'}
          </p>
          <p style={{ fontSize: 11, color: '#b0aa9f' }}>this year so far</p>
        </div>

        {/* Card 3: Total Invested */}
        <div style={{ ...s.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#b5a8d6', opacity: 0.7 }} />
          <div style={{ marginTop: 4, marginBottom: 6 }}><span style={s.label}>TOTAL INVESTED</span></div>
          <p style={{ fontSize: 19, fontWeight: 600, color: ytdInvested > 0 ? '#1a1714' : '#b0aa9f', marginBottom: 2 }}>
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
              <p style={{ fontSize: 19, fontWeight: 600, color: '#b0aa9f', marginBottom: 2 }}>—</p>
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
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={dashGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={dashColor} stopOpacity={dashIsPositive ? 0.25 : 0.20} />
                    <stop offset="95%" stopColor={dashColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => fmtChart(v, currency.symbol)} />
                <Tooltip content={<ChartTip symbol={currency.symbol} />} />
                <Area type="monotone" dataKey="total" name="Net Worth" stroke={dashColor} fill={`url(#${dashGradId})`} strokeWidth={2} dot={{ fill: dashColor, r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, marginBottom: 16, textAlign: 'center', padding: '20px', color: '#b0aa9f', fontSize: 13, background: '#fdfcfa', border: '1px solid #f0ece4' }}>
          Net worth trend will appear once you've logged 2 months of account snapshots.
        </div>
      )}

      {/* Account Balances — collapsible groups */}
      {hasAnyAccounts && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <Lbl>ACCOUNT BALANCES</Lbl>
          <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16, marginTop: 4 }}>
            Latest snapshot{latestSnapMonth ? ` · ${latestSnapMonth} ${selectedYear}` : ''}
          </p>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#9e9890', borderBottom: '1px solid #f0ece4' }}>ACCOUNT</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#9e9890', borderBottom: '1px solid #f0ece4' }}>BALANCE</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#9e9890', borderBottom: '1px solid #f0ece4' }}>IN {(state.currencyCode || 'GBP').toUpperCase()}</th>
              </tr>
            </thead>
            <tbody>
              {allAccountsWithGroup.map(group => {
                const hdrStyle = GROUP_HEADER_STYLES[group.label] || { background: '#f9f7f3', color: '#9e9890' };
                const groupKey = group.label;
                const isExpanded = !!expandedGroups[groupKey];
                const groupTotal = group.accs.reduce((sum, acc) => {
                  const v = latestSnapshots?.[acc.id] || 0;
                  const h = toHome(v, acc.currency);
                  return sum + (h ?? 0);
                }, 0);
                return [
                  <tr
                    key={`hdr-${group.label}`}
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                    style={{ cursor: 'pointer' }}
                  >
                    <td colSpan={2} style={{ padding: '10px 0 10px 12px', background: hdrStyle.background }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: hdrStyle.color }}>
                        {group.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', background: hdrStyle.background }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: hdrStyle.color, fontWeight: 600, fontSize: 13 }}>
                        <span>{f(groupTotal)}</span>
                        <span style={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          borderRight: '1.5px solid ' + hdrStyle.color,
                          borderBottom: '1.5px solid ' + hdrStyle.color,
                          transform: isExpanded ? 'rotate(45deg) translateY(-2px)' : 'rotate(-45deg)',
                          transition: 'transform 0.2s ease',
                          opacity: 0.7,
                          flexShrink: 0,
                        }} />
                      </div>
                    </td>
                  </tr>,
                  ...(isExpanded ? group.accs.map(acc => {
                    const localVal = latestSnapshots?.[acc.id] || 0;
                    const accCur = getCurrency(acc.currency);
                    const flag = getCurrencyFlag(acc.currency);
                    const homeVal = toHome(localVal, acc.currency);
                    return (
                      <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: '#1a1714', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {acc.name}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: '#1a1714', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {localVal > 0
                            ? <span>{flag && <span style={{ marginRight: 4 }}>{flag}</span>}{accCur.symbol}{new Intl.NumberFormat(accCur.locale, { maximumFractionDigits: 0 }).format(localVal)}</span>
                            : <span style={{ color: '#d5d0c8' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: localVal > 0 ? '#1a1714' : '#d5d0c8', fontWeight: localVal > 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
                          {localVal > 0 ? (homeVal !== null ? f(homeVal) : 'Rate unavailable') : '—'}
                        </td>
                      </tr>
                    );
                  }) : []),
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

    </div>
  );
}
