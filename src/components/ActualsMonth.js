import { useState, useEffect, useRef } from 'react';
import {
  s, Lbl, Inp, Divider, EditableCell,
  CAT_COLORS, CATEGORIES, ACCOUNT_GROUPS, GROUP_HEADER_STYLES,
  getCurrency, getCurrencyFlag, getCurrentMonthAbbr, CURRENCIES,
} from '../shared';
import ExpenseTracker from './ExpenseTracker';

// ── Balance Cell (Balances table only) ────────────────────────────────────────
// Fixed 120px across all states — no layout shift on click, underline style only
function BalanceCell({ value, onChange, prefix = '' }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const hasValue = value !== null && value !== undefined && value !== '' && value !== 0;
  const formatted = hasValue
    ? `${prefix}${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(value))}`
    : null;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={value || ''}
        onChange={e => onChange(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
        onBlur={() => setEditing(false)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') setEditing(false);
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: 120, background: 'transparent', border: 'none',
          borderBottom: '1px solid #7eb5d6', borderRadius: 0,
          padding: '0 0 1px 0', fontSize: 14, color: '#1a1714',
          outline: 'none', fontFamily: 'inherit', MozAppearance: 'textfield',
        }}
      />
    );
  }

  return (
    <span onClick={() => setEditing(true)} style={{ cursor: 'text' }}>
      <span style={{
        display: 'inline-block', width: 120, textAlign: 'left',
        ...(hasValue
          ? { color: '#1a1714', fontWeight: 500, fontSize: 14 }
          : { color: '#b0aa9f', borderBottom: '1px solid #d5d0c8', paddingBottom: 1 }
        ),
      }}>
        {hasValue ? formatted : '—'}
      </span>
    </span>
  );
}

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
  state, set, f, currency, MONTHS, baseIncome, allocByCat,
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
  const getIncomeActual = (month, srcId) => state.incomeActuals?.[month]?.[srcId] ?? '';
  const setIncomeActual = (month, srcId, val) => set('incomeActuals', prev => ({
    ...prev, [month]: { ...((prev || {})[month] || {}), [srcId]: val },
  }));
  const getSnap = (month, accId) => state.accountSnapshots?.[month]?.[accId] ?? '';
  const setSnap = (month, accId, val) => set('accountSnapshots', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [accId]: val },
  }));

  const planned = {
    income:      baseIncome,
    Savings:     (allocByCat.Savings     / 100) * baseIncome,
    Investments: (allocByCat.Investments / 100) * baseIncome,
    Needs:       (allocByCat.Needs       / 100) * baseIncome,
    Wants:       (allocByCat.Wants       / 100) * baseIncome,
  };

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
                            <td style={{ padding: '4px 8px 4px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <BalanceCell
                                  value={localVal}
                                  onChange={v => setSnap(selectedMonth, acc.id, v)}
                                  prefix={accCur.symbol}
                                />
                                <span style={{
                                  display: 'inline-block', width: 56, flexShrink: 0,
                                  textAlign: 'left', fontSize: 13, color: '#9e9890',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {flag} {accCur.code}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px', color: homeVal === null ? '#d5d0c8' : '#2d2a26', fontWeight: 500 }}>
                              {homeVal === null ? (localVal !== '' ? 'Rate unavailable' : '—') : f(homeVal)}
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

          {/* Income section — per source */}
          {(() => {
            const homeCode = state.currencyCode || 'GBP';

            // Compute total actual income in home currency
            const totalActualHome = state.incomeSources.reduce((sum, src) => {
              const raw = getIncomeActual(selectedMonth, src.id);
              if (raw === '' || raw === undefined) return sum;
              const converted = toHome(Number(raw) || 0, src.currency || homeCode);
              return sum + (converted ?? 0);
            }, 0);
            const hasAnyActual = state.incomeSources.some(src => {
              const raw = getIncomeActual(selectedMonth, src.id);
              return raw !== '' && raw !== undefined;
            });

            const cardStyle = {
              background: '#fff',
              border: '1px solid #e8e4dc',
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 12,
            };

            return (
              <>
                {/* Header: label + health score */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <Lbl>INCOME — {selectedMonth.toUpperCase()}</Lbl>
                  {healthScore && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      padding: '3px 10px', borderRadius: 20,
                      background: healthScore.bg, border: `1px solid ${healthScore.border}`,
                      color: healthScore.color, whiteSpace: 'nowrap',
                    }}>
                      {healthScore.label === 'On Track' ? '✓' : healthScore.label === 'Slightly Off' ? '⚠' : '✗'} {healthScore.label}
                    </span>
                  )}
                </div>

                {/* Per-source cards */}
                {state.incomeSources.map(src => {
                  const srcCur = CURRENCIES.find(c => c.code === (src.currency || homeCode)) || CURRENCIES[0];
                  const flag = getCurrencyFlag(src.currency || homeCode);
                  const plannedLocal = Number(src.amount) || 0;
                  const actualRaw = getIncomeActual(selectedMonth, src.id);
                  const actualLocal = actualRaw !== '' ? (Number(actualRaw) || 0) : null;
                  const diffLocal = actualLocal !== null ? actualLocal - plannedLocal : null;

                  const fSrc = (v) => `${srcCur.symbol}${new Intl.NumberFormat(srcCur.locale, { maximumFractionDigits: 0 }).format(Math.abs(v))}`;
                  const diffDisplay = diffLocal === null || diffLocal === 0
                    ? '—'
                    : `${diffLocal > 0 ? '+' : '-'}${fSrc(diffLocal)}`;
                  const diffColor = diffLocal === null || diffLocal === 0
                    ? '#b0aa9f'
                    : diffLocal > 0 ? '#2d9e6b' : '#D96B6B';

                  return (
                    <div key={src.id} style={cardStyle}>
                      {/* Top row: name + currency badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1714' }}>{src.label}</span>
                        <span style={{
                          fontSize: 12, color: '#9e9890',
                          background: '#f9f7f3', border: '1px solid #e8e4dc',
                          borderRadius: 6, padding: '2px 8px',
                        }}>
                          {flag && `${flag} `}{srcCur.code}
                        </span>
                      </div>

                      {/* Three columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 24, alignItems: 'start' }}>
                        {/* Planned */}
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>PLANNED</p>
                          <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1714' }}>{fSrc(plannedLocal)}</p>
                          <p style={{ fontSize: 11, color: '#b0aa9f', marginTop: 4 }}>From Plan → Income</p>
                        </div>

                        {/* Actual */}
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>ACTUAL</p>
                          <EditableCell
                            value={actualRaw}
                            onChange={v => setIncomeActual(selectedMonth, src.id, v)}
                            prefix={srcCur.symbol}
                            width="100%"
                          />
                        </div>

                        {/* Difference */}
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>DIFFERENCE</p>
                          <p style={{ fontSize: 18, fontWeight: 600, color: diffColor, paddingTop: 10 }}>
                            {diffDisplay}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Summary card — only when multiple sources */}
                {state.incomeSources.length > 1 && (() => {
                  const totalDiff = totalActualHome - planned.income;
                  const totalDiffDisplay = !hasAnyActual || totalDiff === 0
                    ? '—'
                    : `${totalDiff > 0 ? '+' : ''}${f(totalDiff)}`;
                  const totalDiffColor = !hasAnyActual || totalDiff === 0
                    ? '#b0aa9f'
                    : totalDiff > 0 ? '#2d9e6b' : '#D96B6B';
                  return (
                    <div style={cardStyle}>
                      <div style={{ marginBottom: 20 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1714' }}>Total Income</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 24, alignItems: 'start' }}>
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>PLANNED</p>
                          <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1714' }}>{f(planned.income)}</p>
                          <p style={{ fontSize: 11, color: '#b0aa9f', marginTop: 4 }}>{homeCode}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>ACTUAL</p>
                          <p style={{ fontSize: 18, fontWeight: 600, color: '#1a1714', paddingTop: 10 }}>
                            {hasAnyActual ? f(totalActualHome) : '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>DIFFERENCE</p>
                          <p style={{ fontSize: 18, fontWeight: 600, color: totalDiffColor, paddingTop: 10 }}>
                            {totalDiffDisplay}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {/* Secondary income allocation breakdowns */}
          {state.incomeSources.length > 1 && (() => {
            const secondaryAllocations = state.secondaryAllocations || {};
            const secondarySources = state.incomeSources.slice(1).filter(src => {
              const rules = secondaryAllocations[src.id];
              return rules && rules.length > 0;
            });
            if (secondarySources.length === 0) return null;
            return (
              <div style={{ ...s.card, marginBottom: 14 }}>
                <Lbl>SECONDARY INCOME ALLOCATION</Lbl>
                {secondarySources.map(src => {
                  const homeCode = state.currencyCode || 'GBP';
                  const isForeign = (src.currency || homeCode) !== homeCode;
                  const converted = toHome(Number(src.amount) || 0, src.currency || homeCode);
                  const srcCur = CURRENCIES.find(c => c.code === (src.currency || homeCode)) || CURRENCIES[0];
                  const localFmt = `${srcCur.symbol}${new Intl.NumberFormat(srcCur.locale, { maximumFractionDigits: 0 }).format(Math.abs(Number(src.amount) || 0))}`;
                  const rules = secondaryAllocations[src.id] || [];
                  return (
                    <div key={src.id} style={{ marginTop: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#2d2a26', marginBottom: 6 }}>
                        {src.label}
                        <span style={{ fontSize: 11, color: '#b0aa9f', fontWeight: 400, marginLeft: 6 }}>
                          {isForeign ? `${localFmt} (${converted !== null ? f(converted) : 'no rate'}) / month` : `${f(Number(src.amount) || 0)} / month`}
                        </span>
                      </p>
                      {rules.map(rule => {
                        const monthlyAmt = converted !== null ? ((Number(rule.pct) || 0) / 100) * converted : null;
                        return (
                          <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, paddingLeft: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 1, background: CAT_COLORS[rule.category] || '#b0aa9f', flexShrink: 0 }} />
                              <span style={{ color: '#6b6660' }}>{rule.label}</span>
                              <span style={{ color: '#b0aa9f', fontSize: 10 }}>{(Number(rule.pct) || 0).toFixed(0)}%</span>
                            </div>
                            <span style={{ color: '#4a4643', fontWeight: 500 }}>{monthlyAmt !== null ? f(monthlyAmt) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
                          {diff >= 0 ? '+' : ''}{f(diff)}
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
                              <EditableCell
                                value={manualVal !== '' && manualVal !== undefined ? manualVal : (autoVal !== undefined ? autoVal : '')}
                                onChange={v => setActual(selectedMonth, cat, v)}
                                prefix={currency.symbol}
                                width={120}
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
