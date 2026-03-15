import { useState, useEffect } from 'react';
import {
  s, Lbl, Inp, Divider,
  CAT_COLORS, CATEGORIES, ACCOUNT_GROUPS, GROUP_HEADER_STYLES,
  getCurrency, getCurrencyFlag, getCurrentMonthAbbr,
} from '../shared';
import ExpenseTracker from './ExpenseTracker';

// ── Trades Placeholder ────────────────────────────────────────────────────────
function TradesPlaceholder() {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ ...s.card, textAlign: 'center', padding: '48px 32px' }}>
        <span style={{
          display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          color: '#b0aa9f', background: '#f0ece4', borderRadius: 20, padding: '4px 12px', marginBottom: 16,
        }}>COMING SOON</span>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 22, color: '#1a1714', marginBottom: 8 }}>Trades Tracker</p>
        <p style={{ fontSize: 13, color: '#9e9890', maxWidth: 340, margin: '0 auto' }}>
          Track your crypto, equity and other investment trades with P&amp;L, win rate, and portfolio analytics.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ActualsMonth({
  state, set, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  toHome, selectedYear, modules, trackerTargetSubTab, setTrackerTargetSubTab,
}) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthAbbr());
  const [trackerTab, setTrackerTab]       = useState('balances');

  // Respond to external navigation requests (e.g. from Dashboard checklist)
  useEffect(() => {
    if (trackerTargetSubTab) {
      setTrackerTab(trackerTargetSubTab);
      setTrackerTargetSubTab(null);
    }
  }, [trackerTargetSubTab, setTrackerTargetSubTab]); // eslint-disable-line

  const mods = modules || { income: true, expenses: true, trades: true };

  // Available sub-tabs (Balances always shown)
  const SUB_TABS = [
    { id: 'balances',  label: 'Balances' },
    ...(mods.income   ? [{ id: 'income',   label: 'Income' }]   : []),
    ...(mods.expenses ? [{ id: 'expenses', label: 'Expenses' }] : []),
    ...(mods.trades   ? [{ id: 'trades',   label: 'Trades' }]   : []),
  ];

  // If current tab was hidden by toggling a module, fall back to balances
  const activeTab = SUB_TABS.find(t => t.id === trackerTab) ? trackerTab : 'balances';

  const getActual = (month, key) => state.actuals[month]?.[key] ?? '';
  const setActual = (month, key, val) => set('actuals', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [key]: val },
  }));
  const getSnap = (month, accId) => state.accountSnapshots?.[month]?.[accId] ?? '';
  const setSnap = (month, accId, val) => set('accountSnapshots', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [accId]: val },
  }));

  const inc     = monthIncome(selectedMonth);
  const planned = {
    income:      inc,
    Savings:     (allocByCat.Savings     / 100) * inc,
    Investments: (allocByCat.Investments / 100) * inc,
    Needs:       (allocByCat.Needs       / 100) * inc,
    Wants:       (allocByCat.Wants       / 100) * inc,
  };

  const actualIncome  = Number(getActual(selectedMonth, 'income')) || 0;
  const currentMonth  = getCurrentMonthAbbr();
  const monthIdx      = MONTHS.indexOf(selectedMonth);
  const prevMonth     = monthIdx > 0 ? MONTHS[monthIdx - 1] : null;

  // Account groups for Balances sub-tab
  const accountGroups = ACCOUNT_GROUPS.map(group => {
    const accs = (state.accounts || []).filter(a => group.types.includes(a.type));
    return { ...group, accounts: accs };
  }).filter(g => g.accounts.length > 0);

  // Health score (used in Income sub-tab)
  const healthScore = (() => {
    const hasData = Object.values(state.actuals[selectedMonth] || {}).some(v => v > 0);
    if (!hasData) return null;
    let offCount = 0;
    CATEGORIES.forEach(cat => {
      const actual = Number(getActual(selectedMonth, cat)) || 0;
      const plan   = planned[cat];
      if (cat === 'Savings' || cat === 'Investments') { if (actual < plan * 0.9)  offCount++; }
      else                                            { if (actual > plan * 1.1)  offCount++; }
    });
    if (offCount === 0) return { label: 'On Track',    color: '#2d9e6b', bg: '#f0fdf4', border: '#bbf7d0' };
    if (offCount <= 2)  return { label: 'Slightly Off', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    return               { label: 'Over Budget',  color: '#c94040', bg: '#fdf2f2', border: '#fecaca' };
  })();

  // Month pills shared between Balances and Income
  const MonthPills = () => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
      {MONTHS.map(month => (
        <button key={month} onClick={() => setSelectedMonth(month)} style={{
          padding: '6px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
          border: month === selectedMonth ? '2px solid #2d2a26' : '1px solid #e8e4dc',
          background: month === selectedMonth ? '#2d2a26' : '#fff',
          color: month === selectedMonth ? '#fff' : month === currentMonth ? '#7eb5d6' : '#6b6660',
          cursor: 'pointer', fontWeight: (month === selectedMonth || month === currentMonth) ? 600 : 400,
        }}>{month}</button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', marginBottom: 4 }}>Tracker — {selectedYear}</p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e4dc' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setTrackerTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === t.id ? '2px solid #2d2a26' : '2px solid transparent',
            color: activeTab === t.id ? '#1a1714' : '#a09890',
            cursor: 'pointer', padding: '12px 18px',
            fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Balances ── */}
      {activeTab === 'balances' && (
        <div>
          <MonthPills />
          <div style={s.card}>
            <Lbl>ACCOUNT SNAPSHOTS — {selectedMonth.toUpperCase()}</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              End-of-month balances. Auto-converts to {state.currencyCode || 'GBP'}.
              {(() => {
                const snap = state.accountSnapshots?.[selectedMonth];
                const hasData = snap && Object.values(snap).some(v => v > 0);
                return hasData ? <span style={{ marginLeft: 6, color: '#c5c0b8' }}>· Updated {selectedMonth} {selectedYear}</span> : null;
              })()}
            </p>

            {accountGroups.length === 0 ? (
              <p style={{ fontSize: 13, color: '#b0aa9f' }}>No accounts set up yet. Add them in Settings → Accounts.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Account', `Balance (Local)`, `In ${state.currencyCode || 'GBP'}`, 'Change'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountGroups.map(group => {
                    const hdrStyle = GROUP_HEADER_STYLES[group.label] || { background: '#f9f7f3', color: '#9e9890' };
                    return [
                      <tr key={`hdr-${group.label}`} style={{ background: hdrStyle.background }}>
                        <td colSpan={4} style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: hdrStyle.color, letterSpacing: '0.1em' }}>
                          {group.label.toUpperCase()}
                        </td>
                      </tr>,
                      ...group.accounts.map(acc => {
                        const localVal = getSnap(selectedMonth, acc.id);
                        const accCur   = getCurrency(acc.currency);
                        const flag     = getCurrencyFlag(acc.currency);
                        const numVal   = Number(localVal) || 0;
                        const homeVal  = localVal !== '' ? toHome(numVal, acc.currency) : null;
                        const prevVal  = prevMonth ? (Number(getSnap(prevMonth, acc.id)) || 0) : 0;
                        const pct      = numVal > 0
                          ? (prevVal > 0 ? ((numVal - prevVal) / prevVal) * 100 : 'no-prev')
                          : null;
                        return (
                          <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a1714' }}>{acc.name}</td>
                            <td style={{ padding: '4px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ flexShrink: 0, fontSize: 12, color: '#b0aa9f', marginRight: 4 }}>
                                  {flag && <span style={{ marginRight: 2 }}>{flag}</span>}{accCur.symbol}
                                </span>
                                <Inp type="number" value={localVal} placeholder="—"
                                  onChange={v => setSnap(selectedMonth, acc.id, v)}
                                  style={{ width: 110 }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', color: homeVal === null ? '#d5d0c8' : '#2d2a26', fontWeight: 500 }}>
                              {homeVal === null ? (localVal !== '' ? 'Rate unavailable' : '—') : f(homeVal, true)}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              {pct === null ? null : pct === 'no-prev' ? (
                                <span style={{ fontSize: 11, color: '#d5d0c8' }}>—</span>
                              ) : (
                                <span style={{ fontSize: 11, color: pct >= 0 ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>
                                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Income ── */}
      {activeTab === 'income' && (
        <div>
          <MonthPills />

          {/* Health score badge */}
          {healthScore && (
            <div style={{
              display: 'inline-block', padding: '6px 14px', borderRadius: 8, marginBottom: 16,
              background: healthScore.bg, border: `1px solid ${healthScore.border}`,
              fontSize: 13, fontWeight: 600, color: healthScore.color,
            }}>
              {healthScore.label === 'On Track' ? '✓' : healthScore.label === 'Slightly Off' ? '⚠' : '✗'} {healthScore.label}
            </div>
          )}

          {/* Income section */}
          <div style={{ ...s.card, marginBottom: 14 }}>
            <Lbl>INCOME — {selectedMonth.toUpperCase()}</Lbl>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 4 }}>Planned</p>
                <p style={{ fontSize: 16, fontWeight: 600 }}>{f(planned.income)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 4 }}>Actual</p>
                <Inp type="number" value={getActual(selectedMonth, 'income')} placeholder={f(planned.income)}
                  onChange={v => {
                    setActual(selectedMonth, 'income', v);
                    if (v && v !== baseIncome) {
                      set('monthlyIncomeOverrides', prev => {
                        const n = { ...prev };
                        if (!v || v === baseIncome) delete n[selectedMonth]; else n[selectedMonth] = v;
                        return n;
                      });
                    }
                  }}
                  style={{ fontSize: 14, fontWeight: 600 }}
                />
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 4 }}>Difference</p>
                {actualIncome > 0 ? (
                  <p style={{ fontSize: 16, fontWeight: 600, color: actualIncome >= planned.income ? '#2d9e6b' : '#c94040' }}>
                    {actualIncome >= planned.income ? '+' : ''}{f(actualIncome - planned.income)}
                  </p>
                ) : (
                  <p style={{ fontSize: 16, color: '#d5d0c8' }}>—</p>
                )}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div style={{ ...s.card, marginBottom: 14 }}>
            <Lbl>CATEGORIES — {selectedMonth.toUpperCase()}</Lbl>
            <div style={{ marginTop: 12 }}>
              {CATEGORIES.map(cat => {
                const plan     = planned[cat];
                const actual   = Number(getActual(selectedMonth, cat)) || 0;
                const hasActual = getActual(selectedMonth, cat) !== '' && actual > 0;
                const diff     = actual - plan;
                const isGood   = (cat === 'Savings' || cat === 'Investments') ? actual >= plan : actual <= plan;
                const progress = plan > 0 ? Math.min((actual / plan) * 100, 150) : 0;

                return (
                  <div key={cat} style={{ marginBottom: 16, padding: '12px 14px', background: '#fdfcfa', borderRadius: 10, border: '1px solid #f0ece4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[cat] }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#4a4643' }}>{cat}</span>
                      </div>
                      {hasActual && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: isGood ? '#2d9e6b' : '#c94040' }}>
                          {diff >= 0 ? '+' : ''}{f(diff, true)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 10, color: '#b0aa9f', marginBottom: 2 }}>Planned</p>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#9e9890' }}>{f(plan)}</p>
                      </div>
                      <div>
                        {(() => {
                          const autoVal = state.expenseAutoActuals?.[selectedMonth]?.[cat];
                          const manualVal = getActual(selectedMonth, cat);
                          const isAutoFilled = (manualVal === '' || manualVal === undefined) && autoVal !== undefined;
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <p style={{ fontSize: 10, color: '#b0aa9f' }}>Actual</p>
                                {isAutoFilled && (
                                  <span style={{ fontSize: 9, color: '#7eb5d6', letterSpacing: '0.05em', fontWeight: 600 }}>AUTO</span>
                                )}
                              </div>
                              <Inp type="number"
                                value={manualVal !== '' && manualVal !== undefined ? manualVal : (autoVal !== undefined ? autoVal : '')}
                                placeholder="—"
                                onChange={v => setActual(selectedMonth, cat, v)}
                                style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px' }}
                              />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(progress, 100)}%`,
                        background: hasActual ? (isGood ? '#7ec8a0' : '#e8a598') : '#e8e4dc',
                        borderRadius: 4, transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Divider />
          <p style={{ fontSize: 12, color: '#b0aa9f' }}>
            Log account balances in the Balances tab. View full-year data in the Net Worth tab.
          </p>
        </div>
      )}

      {/* ── Expenses ── */}
      {activeTab === 'expenses' && (
        <ExpenseTracker
          state={state} set={set} f={f} currency={currency}
          toHome={toHome} selectedYear={selectedYear} MONTHS={MONTHS}
        />
      )}

      {/* ── Trades ── */}
      {activeTab === 'trades' && <TradesPlaceholder />}
    </div>
  );
}
