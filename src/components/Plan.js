import { useState, useRef, useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  s, Lbl, DelBtn, AddBtn, Divider, EditableCell, blockNonNumeric, pasteNumericOnly,
  CAT_COLORS, CATEGORIES, CURRENCIES, fmtChart, ChartTip,
} from '../shared';

const SUB_TABS = [
  { id: 'allocation', label: 'Allocation' },
  { id: 'goals',      label: 'Goals' },
];

// ── Reusable Allocation Table ──────────────────────────────────────────────────
function AllocationTable({ rows, setRows, monthlyBase, f, title, subtitle }) {
  const [dragId, setDragId]           = useState(null);
  const [dragOverId, setDragOverId]   = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const dragNode = useRef(null);

  const totalPct = rows.reduce((sum, r) => sum + (Number(r.pct) || 0), 0);

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: subtitle ? 4 : 16 }}>
        <Lbl>{title}</Lbl>
        <button
          onClick={() => setRows(prev => [...prev, { id: Date.now(), label: 'New Item', category: 'Wants', pct: 0 }])}
          style={{ fontSize: 11, background: 'transparent', border: '1px dashed #d8d4cc', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', color: '#a09890' }}
        >+ Add row</button>
      </div>
      {subtitle && <p style={{ fontSize: 12, color: '#6b6660', marginBottom: 16 }}>{subtitle}</p>}

      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '7%' }}  />
          <col style={{ width: '6%' }}  />
        </colgroup>
        <thead>
          <tr>
            {['Label', 'Category', '% of Income', 'Monthly Amount', '', ''].map((h, i) => (
              <th key={i} style={{
                padding: '8px 10px', paddingLeft: i === 0 ? 19 : 10,
                color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em',
                textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              draggable
              onMouseEnter={() => setHoveredRowId(row.id)}
              onMouseLeave={() => setHoveredRowId(null)}
              onDragStart={() => { setDragId(row.id); dragNode.current = row.id; }}
              onDragOver={e => { e.preventDefault(); setDragOverId(row.id); }}
              onDrop={() => {
                if (dragId !== null && dragId !== row.id) {
                  setRows(prev => {
                    const next = [...prev];
                    const from = next.findIndex(x => x.id === dragId);
                    const to   = next.findIndex(x => x.id === row.id);
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    return next;
                  });
                }
                setDragId(null); setDragOverId(null);
              }}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              style={{
                borderBottom: '1px solid #f9f7f3',
                borderLeft: `3px solid ${CAT_COLORS[row.category] || '#e8e4dc'}`,
                borderTop: dragOverId === row.id && dragId !== row.id ? '2px solid #7eb5d6' : undefined,
                opacity: dragId === row.id ? 0.4 : 1,
              }}
            >
              {/* Label input — underline only */}
              <td style={{ padding: '5px 10px', paddingLeft: 4 }}>
                <input
                  value={row.label}
                  onChange={e => setRows(prev => prev.map(x => x.id === row.id ? { ...x, label: e.target.value } : x))}
                  onMouseEnter={e => { if (document.activeElement !== e.target) e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                  onMouseLeave={e => { if (document.activeElement !== e.target) e.target.style.borderBottom = 'none'; }}
                  onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                  onBlur={e => { e.target.style.borderBottom = e.target.matches(':hover') ? '1px solid #e8e4dc' : 'none'; }}
                  style={{
                    background: 'transparent', border: 'none', borderBottom: 'none', outline: 'none',
                    width: '100%', fontSize: 13, fontFamily: 'inherit', color: '#2d2a26',
                    padding: '4px 0 4px 12px', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                />
              </td>

              {/* Category dropdown — underline only, custom chevron */}
              <td style={{ padding: '5px 10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={row.category}
                    onChange={e => setRows(prev => prev.map(x => x.id === row.id ? { ...x, category: e.target.value } : x))}
                    onMouseEnter={e => { if (document.activeElement !== e.target) e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                    onMouseLeave={e => { if (document.activeElement !== e.target) e.target.style.borderBottom = 'none'; }}
                    onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                    onBlur={e => { e.target.style.borderBottom = e.target.matches(':hover') ? '1px solid #e8e4dc' : 'none'; }}
                    style={{
                      background: 'transparent', border: 'none', borderBottom: 'none', outline: 'none',
                      width: 'auto', fontSize: 13, fontFamily: 'inherit', color: '#2d2a26',
                      padding: '4px 28px 4px 0', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <span style={{ pointerEvents: 'none', color: '#9e9890', fontSize: 11, flexShrink: 0 }}>▾</span>
                </span>
              </td>

              {/* % of Income — EditableCell, left-aligned, % suffix */}
              <td style={{ padding: '5px 10px' }}>
                <EditableCell
                  value={row.pct === 0 ? '' : row.pct}
                  onChange={v => setRows(prev => prev.map(x => x.id === row.id ? { ...x, pct: v === '' ? 0 : (Number(v) || 0) } : x))}
                  suffix="%"
                  width={80}
                />
              </td>

              {/* Monthly Amount — plain text, auto-calculated */}
              <td style={{ padding: '5px 10px', fontWeight: 500, color: '#4a4643' }}>
                {monthlyBase !== null ? f(((Number(row.pct) || 0) / 100) * monthlyBase) : '—'}
              </td>

              {/* Delete × */}
              <td style={{ padding: '5px 10px' }}>
                <DelBtn onClick={() => setRows(prev => prev.filter(x => x.id !== row.id))} />
              </td>

              {/* Drag handle ⠿ */}
              <td style={{
                padding: '5px 6px', textAlign: 'center', color: '#d0ccc5', fontSize: 16,
                cursor: 'grab', userSelect: 'none', opacity: hoveredRowId === row.id ? 1 : 0,
              }}>⠿</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Divider />

      {/* Footer — "Total allocated" + % aligned under % of Income column */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ padding: '6px 10px', paddingLeft: 19, color: '#9e9890' }}>Total allocated</td>
            <td />
            <td style={{ padding: '6px 10px', fontWeight: 700, color: totalPct > 100 ? '#c94040' : '#1a1714' }}>
              {totalPct.toFixed(1)}%
            </td>
            <td /><td /><td />
          </tr>
        </tbody>
      </table>

      {totalPct > 100 && (
        <p style={{ fontSize: 11, color: '#c94040', marginTop: 10, background: '#fdf2f2', padding: '6px 10px', borderRadius: 7 }}>
          ⚠ Total: {totalPct.toFixed(1)}% — over 100%
        </p>
      )}
    </div>
  );
}

// ── Main Plan component ────────────────────────────────────────────────────────
export default function Plan({
  state, set, f, currency, baseIncome, allocByCat, totalAllocPct,
  netWorth, selectedYear, navigate, toHome, fxRates,
  latestSnapshots, totalLiabilities, MONTHS,
}) {
  const [subTab, setSubTab] = useState('allocation');

  const homeCode = state.currencyCode || 'GBP';

  const fLocal = (amount, code) => {
    const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
    return `${cur.symbol}${new Intl.NumberFormat(cur.locale, { maximumFractionDigits: 0 }).format(Math.abs(amount))}`;
  };

  const srcToHome = (src) => toHome(Number(src.amount) || 0, src.currency || homeCode);

  const isMultiCurrency = state.incomeSources.some(src => (src.currency || homeCode) !== homeCode);

  // Net worth trend chart data (same logic as NetWorth.js)
  const chartData = useMemo(() => {
    if (!MONTHS) return [];
    return MONTHS.map(month => {
      const snap = state.accountSnapshots?.[month];
      if (!snap || !Object.values(snap).some(v => v > 0)) return null;
      const total = (state.accounts || []).reduce((sum, acc) => {
        const v = snap[acc.id] || 0;
        const h = toHome(v, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      return { month, total: Math.round(total - (totalLiabilities || 0)) };
    }).filter(Boolean);
  }, [MONTHS, state.accountSnapshots, state.accounts, toHome, totalLiabilities]);

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e4dc' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: subTab === t.id ? '2px solid #2d2a26' : '2px solid transparent',
            color: subTab === t.id ? '#1a1714' : '#a09890',
            cursor: 'pointer', padding: '12px 18px',
            fontSize: 13, fontWeight: subTab === t.id ? 600 : 400,
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Goals ── */}
      {subTab === 'goals' && (() => {
        const goal = state.goalNetWorth || 0;
        const pct  = goal > 0 ? Math.max(0, (netWorth / goal) * 100) : 0;
        const reached = pct >= 100;

        // Average monthly savings from trend data
        const avgMonthlySavings = chartData.length >= 2
          ? (chartData[chartData.length - 1].total - chartData[0].total) / (chartData.length - 1)
          : null;

        // Projection date
        let projectionText = null;
        if (goal > 0 && !reached) {
          if (avgMonthlySavings !== null && avgMonthlySavings > 0) {
            const monthsNeeded = Math.ceil((goal - netWorth) / avgMonthlySavings);
            const projDate = new Date();
            projDate.setMonth(projDate.getMonth() + monthsNeeded);
            projectionText = `At your current savings rate: ${projDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
          } else {
            projectionText = 'Not enough savings data to project.';
          }
        }

        // Account group totals for donut chart
        const accountGroupTotals = latestSnapshots ? (() => {
          const banks = (state.accounts || [])
            .filter(acc => ['Bank', 'Savings', 'Cash'].includes(acc.type))
            .reduce((sum, acc) => { const h = toHome(latestSnapshots[acc.id] || 0, acc.currency); return sum + (h ?? 0); }, 0);
          const investments = (state.accounts || [])
            .filter(acc => acc.type === 'Investment')
            .reduce((sum, acc) => { const h = toHome(latestSnapshots[acc.id] || 0, acc.currency); return sum + (h ?? 0); }, 0);
          const crypto = (state.accounts || [])
            .filter(acc => ['Crypto', 'Other'].includes(acc.type))
            .reduce((sum, acc) => { const h = toHome(latestSnapshots[acc.id] || 0, acc.currency); return sum + (h ?? 0); }, 0);
          return { banks, investments, crypto };
        })() : null;

        const donutData = accountGroupTotals ? [
          { name: 'Banks',        value: Math.max(0, accountGroupTotals.banks),       fill: '#5B9BD5' },
          { name: 'Investments',  value: Math.max(0, accountGroupTotals.investments), fill: '#6dbb8a' },
          { name: 'Crypto / Other', value: Math.max(0, accountGroupTotals.crypto),   fill: '#E8A838' },
          ...((totalLiabilities || 0) > 0 ? [{ name: 'Liabilities', value: totalLiabilities, fill: '#e8e4dc' }] : []),
        ].filter(d => d.value > 0) : [];

        // Goal outer ring
        const currentMonthNum = new Date().getMonth();
        const monthsLeft      = 11 - currentMonthNum;
        const projYearEnd     = avgMonthlySavings !== null ? netWorth + avgMonthlySavings * monthsLeft : netWorth;
        const isOnTrack       = goal > 0 && projYearEnd >= goal;
        const goalRingColor   = isOnTrack ? '#6dbb8a' : '#E8A838';
        const goalPct         = goal > 0 ? Math.min(Math.max(0, netWorth / goal), 1) : 0;
        const goalRingData    = goal > 0 ? [
          { name: 'achieved',  value: goalPct * 100 },
          { name: 'remaining', value: (1 - goalPct) * 100 },
        ] : [];

        const nwChartColor = chartData.length < 2 || chartData[chartData.length - 1].total >= chartData[0].total
          ? '#6dbb8a' : '#E8A838';

        const legendTotal = donutData.reduce((sum, d) => sum + d.value, 0);

        return (
          <div>
            {/* Two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: 16, marginBottom: 16, alignItems: 'start' }}>

              {/* Left column — goal input + progress + projection */}
              <div style={s.card}>
                <Lbl>TARGET NET WORTH BY END OF {selectedYear}</Lbl>
                <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 12 }}>
                  Set a net worth target. Tracked against your current net worth on the Dashboard.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ color: '#b0aa9f', fontSize: 13 }}>{currency.symbol}</span>
                  <input
                    type="number"
                    min={0}
                    value={state.goalNetWorth || ''}
                    onChange={e => set('goalNetWorth', e.target.value === '' || isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))}
                    onKeyDown={blockNonNumeric}
                    onPaste={pasteNumericOnly}
                    onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                    onBlur={e => { e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                    placeholder="e.g. 100000"
                    style={{
                      flex: 1, background: 'transparent', border: 'none',
                      borderBottom: '1px solid #e8e4dc', outline: 'none',
                      padding: '4px 0', fontSize: 14, fontFamily: 'inherit', color: '#2d2a26',
                      MozAppearance: 'textfield', WebkitAppearance: 'none',
                    }}
                  />
                </div>

                {/* Progress */}
                {goal <= 0 ? (
                  <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 12 }}>
                    Enter a target above to track your progress.
                  </p>
                ) : reached ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#2d9e6b', marginBottom: 4 }}>
                      ✓ Goal reached — {f(netWorth)} / {f(goal)}
                    </p>
                    <p style={{ fontSize: 12, color: '#2d9e6b' }}>Your net worth has reached this year's target.</p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span style={{ color: '#6b6660' }}>{f(netWorth)} of {f(goal)}</span>
                      <span style={{ fontWeight: 700, color: '#2d2a26' }}>{pct.toFixed(0)}% of the way there</span>
                    </div>
                    <div style={{ height: 8, background: '#f0ece4', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(pct, 100)}%`,
                        background: pct >= 75 ? '#7ec8a0' : pct >= 40 ? '#7eb5d6' : '#e8a598',
                        borderRadius: 8, transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Projection line */}
                <p style={{ fontSize: 12, color: '#6b6660', marginTop: 4 }}>
                  {goal <= 0
                    ? 'Set a goal to see your projection.'
                    : (projectionText || 'Set a goal to see your projection.')}
                </p>
              </div>

              {/* Right column — net worth donut chart */}
              <div style={s.card}>
                <Lbl>WHAT'S MAKING UP YOUR NET WORTH</Lbl>
                {donutData.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#b0aa9f', marginTop: 16 }}>
                    Log account balances in Tracker to see your net worth breakdown.
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 12 }}>
                    <PieChart width={240} height={240}>
                      {/* Inner donut: net worth breakdown */}
                      <Pie
                        data={donutData}
                        cx={120} cy={120}
                        innerRadius={55} outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>

                      {/* Outer ring: % of goal achieved — only if goal set */}
                      {goal > 0 && goalRingData.length > 0 && (
                        <Pie
                          data={goalRingData}
                          cx={120} cy={120}
                          innerRadius={90} outerRadius={95}
                          paddingAngle={0}
                          dataKey="value"
                          startAngle={90} endAngle={-270}
                        >
                          <Cell fill={goalRingColor} strokeWidth={0} />
                          <Cell fill="transparent" stroke="none" strokeWidth={0} />
                        </Pie>
                      )}
                    </PieChart>

                    {/* Legend */}
                    <div>
                      {donutData.map((entry, i) => {
                        const entryPct = legendTotal > 0 ? ((entry.value / legendTotal) * 100).toFixed(0) : 0;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: entry.fill, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: '#6b6660', minWidth: 90 }}>{entry.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#2d2a26' }}>{f(entry.value)}</span>
                            <span style={{ fontSize: 11, color: '#b0aa9f' }}>{entryPct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Full-width area chart — only if 2+ months of snapshot data */}
            {chartData.length >= 2 && (
              <div style={{ ...s.card, marginBottom: 16 }}>
                <Lbl>NET WORTH JOURNEY THIS YEAR</Lbl>
                <div style={{ marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="nwGoalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={nwChartColor} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={nwChartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                      <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                      <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => fmtChart(v, currency.symbol)} />
                      <Tooltip content={<ChartTip symbol={currency.symbol} />} />
                      <Area
                        type="monotone" dataKey="total" name="Net Worth"
                        stroke={nwChartColor} fill="url(#nwGoalGrad)"
                        strokeWidth={2} dot={{ fill: nwChartColor, r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Allocation ── */}
      {subTab === 'allocation' && (
        <div>
          {/* Income Sources — clean underline-only styling */}
          <div style={{ ...s.card, marginBottom: 16 }}>
            <Lbl>BASE MONTHLY INCOME</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 12 }}>
              Used to calculate your monthly allocation amounts.
            </p>
            {state.incomeSources.map(src => {
              const converted = srcToHome(src);
              const isForeign = (src.currency || homeCode) !== homeCode;
              return (
                <div key={src.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Label input — underline only */}
                    <input
                      value={src.label}
                      onChange={e => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, label: e.target.value } : x))}
                      onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                      onBlur={e => { e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                      style={{
                        flex: 2, background: 'transparent', border: 'none',
                        borderBottom: '1px solid #e8e4dc', outline: 'none',
                        padding: '4px 0', fontSize: 14, fontFamily: 'inherit', color: '#2d2a26',
                      }}
                    />
                    {/* Amount input — underline only */}
                    <input
                      type="number"
                      min={0}
                      value={src.amount === 0 ? '' : src.amount}
                      onChange={e => set('incomeSources', prev => prev.map(x => x.id === src.id ? {
                        ...x, amount: e.target.value === '' ? 0 : (Number(e.target.value) || 0),
                      } : x))}
                      onKeyDown={blockNonNumeric}
                      onPaste={pasteNumericOnly}
                      onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                      onBlur={e => { e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                      placeholder="0"
                      style={{
                        flex: 2, background: 'transparent', border: 'none',
                        borderBottom: '1px solid #e8e4dc', outline: 'none',
                        padding: '4px 0', fontSize: 14, fontFamily: 'inherit', color: '#2d2a26',
                        textAlign: 'right', MozAppearance: 'textfield', WebkitAppearance: 'none',
                      }}
                    />
                    {/* Currency select — underline only, custom chevron */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <select
                        value={src.currency || homeCode}
                        onChange={e => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, currency: e.target.value } : x))}
                        onFocus={e => { e.target.style.borderBottom = '1px solid #7eb5d6'; }}
                        onBlur={e => { e.target.style.borderBottom = '1px solid #e8e4dc'; }}
                        style={{
                          background: 'transparent', border: 'none',
                          borderBottom: '1px solid #e8e4dc', outline: 'none',
                          padding: '4px 20px 4px 0', fontSize: 14, fontFamily: 'inherit', color: '#2d2a26',
                          appearance: 'none', WebkitAppearance: 'none',
                          cursor: 'pointer', width: '100%',
                        }}
                      >
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9e9890', fontSize: 11 }}>▾</span>
                    </div>
                    {state.incomeSources.length > 1 && (
                      <DelBtn onClick={() => set('incomeSources', prev => prev.filter(x => x.id !== src.id))} />
                    )}
                  </div>
                  {isForeign && (
                    <div style={{ fontSize: 11, color: converted !== null ? '#b0aa9f' : '#e8a598', paddingLeft: 4, marginTop: 4, lineHeight: 1.4 }}>
                      {converted !== null ? `= ${f(converted)} at current rates` : 'no rate available'}
                    </div>
                  )}
                </div>
              );
            })}
            <AddBtn
              onClick={() => set('incomeSources', prev => [...prev, { id: Date.now(), label: 'New Source', amount: 0, currency: homeCode }])}
              label="+ Add income source"
            />
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, alignItems: 'center' }}>
              <span style={{ color: '#9e9890' }}>Total / month</span>
              <span style={{ fontWeight: 700, color: '#1a1714' }}>
                {f(baseIncome)}
                {isMultiCurrency && <span style={{ fontSize: 11, color: '#b0aa9f', marginLeft: 4 }}>(converted to {homeCode})</span>}
              </span>
            </div>
          </div>

          {/* Allocation donut + benchmark */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {/* Donut chart */}
            <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 20 }}>
              <PieChart width={160} height={160}>
                <Pie data={[
                  ...CATEGORIES.map(cat => ({ name: cat, value: allocByCat[cat] || 0, fill: CAT_COLORS[cat] })),
                  { name: 'Unallocated', value: Math.max(0, 100 - totalAllocPct), fill: '#ede9e1' },
                ]} cx={75} cy={75} innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                  {[0, 1, 2, 3, 4].map(i => <Cell key={i} />)}
                </Pie>
              </PieChart>
              <div>
                {CATEGORIES.map(cat => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: CAT_COLORS[cat] }} />
                    <span style={{ fontSize: 12, color: '#6b6660', width: 88 }}>{cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{(allocByCat[cat] || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom benchmark */}
            <div style={s.card}>
              <Lbl>YOUR BENCHMARK</Lbl>
              <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 12 }}>Set your target percentages.</p>
              {[
                { key: 'benchmarkNeeds',        cat: 'Needs',          yours: allocByCat['Needs'] || 0,                                              lowerIsBetter: true,  barColor: '#E8A838' },
                { key: 'benchmarkWants',        cat: 'Wants',          yours: allocByCat['Wants'] || 0,                                              lowerIsBetter: true,  barColor: '#D96B6B' },
                { key: 'benchmarkSavingsInvest', cat: 'Savings + Invest', yours: (allocByCat['Savings'] || 0) + (allocByCat['Investments'] || 0), lowerIsBetter: false, barColor: '#6dbb8a' },
              ].map(({ key, cat, yours, lowerIsBetter, barColor }) => {
                const bench = state[key] ?? (key === 'benchmarkNeeds' ? 50 : key === 'benchmarkWants' ? 30 : 20);
                const ok = lowerIsBetter ? yours <= bench : yours >= bench;
                return (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#6b6660' }}>{cat}</span>
                        <span style={{ color: '#b0aa9f', fontSize: 10 }}>target:</span>
                        <input
                          type="number"
                          min={0}
                          value={bench}
                          onChange={e => set(key, parseFloat(e.target.value) || 0)}
                          onKeyDown={blockNonNumeric}
                          onPaste={pasteNumericOnly}
                          style={{ ...s.input, width: 42, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                        />
                        <span style={{ color: '#b0aa9f', fontSize: 10 }}>%</span>
                      </div>
                      <span style={{ color: ok ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>{yours.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(bench > 0 ? (yours / bench) * 100 : 0, 100)}%`,
                        background: barColor, borderRadius: 4, transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                );
              })}
              {totalAllocPct > 100 && (
                <p style={{ fontSize: 11, color: '#c94040', marginTop: 10, background: '#fdf2f2', padding: '6px 10px', borderRadius: 7 }}>
                  ⚠ Total: {totalAllocPct.toFixed(1)}% — over 100%
                </p>
              )}
            </div>
          </div>

          {/* Primary allocation table */}
          <AllocationTable
            rows={state.allocation}
            setRows={updater => set('allocation', updater)}
            monthlyBase={baseIncome}
            f={f}
            title="ALLOCATION RULES"
          />

          {/* Secondary income allocation tables (one per additional income source) */}
          {state.incomeSources.length > 1 && state.incomeSources.slice(1).map(src => {
            const converted = srcToHome(src);
            const isForeign = (src.currency || homeCode) !== homeCode;

            const setRules = updater => set('secondaryAllocations', prev => ({
              ...(prev || {}),
              [src.id]: typeof updater === 'function' ? updater((prev || {})[src.id] || []) : updater,
            }));

            const subtitle = isForeign
              ? `${fLocal(src.amount, src.currency || homeCode)} (${converted !== null ? f(converted) : 'no rate'}) / month`
              : `${f(Number(src.amount) || 0)} / month`;

            return (
              <div key={src.id} style={{ marginTop: 16 }}>
                <AllocationTable
                  rows={(state.secondaryAllocations || {})[src.id] || []}
                  setRows={setRules}
                  monthlyBase={converted}
                  f={f}
                  title={`${src.label.toUpperCase()} — SECONDARY ALLOCATION`}
                  subtitle={subtitle}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
