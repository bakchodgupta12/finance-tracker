import { useState, useRef } from 'react';
import {
  PieChart, Pie, Cell
} from 'recharts';
import {
  s, Lbl, Inp, DelBtn, AddBtn, Divider, Select, EditableCell, blockNonNumeric, pasteNumericOnly,
  CAT_COLORS, CATEGORIES, CURRENCIES
} from '../shared';

const SUB_TABS = [
  { id: 'allocation', label: 'Allocation' },
  { id: 'goals',      label: 'Goals' },
];

export default function Plan({ state, set, f, currency, baseIncome, allocByCat, totalAllocPct, netWorth, selectedYear, navigate, toHome, fxRates }) {
  const [subTab, setSubTab] = useState('allocation');
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const dragNode = useRef(null);

  const homeCode = state.currencyCode || 'GBP';

  // Format a value in a given currency (local display)
  const fLocal = (amount, code) => {
    const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
    return `${cur.symbol}${new Intl.NumberFormat(cur.locale, { maximumFractionDigits: 0 }).format(Math.abs(amount))}`;
  };

  // Convert a source amount to home currency, return null if rate unavailable
  const srcToHome = (src) => toHome(Number(src.amount) || 0, src.currency || homeCode);

  const isMultiCurrency = state.incomeSources.some(s => (s.currency || homeCode) !== homeCode);

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
      {subTab === 'goals' && (
        <div style={{ maxWidth: 560 }}>
          <div style={s.card}>
            <Lbl>TARGET NET WORTH BY END OF {selectedYear}</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 12 }}>
              Set a net worth target. Tracked against your current net worth on the Dashboard.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ color: '#b0aa9f', fontSize: 13 }}>{currency.symbol}</span>
              <Inp
                type="number"
                value={state.goalNetWorth || ''}
                onChange={v => set('goalNetWorth', v === '' || isNaN(parseFloat(v)) ? 0 : parseFloat(v))}
                placeholder="e.g. 100000"
                style={{ flex: 1 }}
              />
            </div>

            {/* Progress */}
            {(() => {
              const goal = state.goalNetWorth || 0;
              if (goal <= 0) return (
                <p style={{ fontSize: 12, color: '#b0aa9f' }}>Enter a target above to track your progress.</p>
              );

              const pct = Math.max(0, (netWorth / goal) * 100);
              const reached = pct >= 100;

              return (
                <div>
                  {reached ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#2d9e6b', marginBottom: 4 }}>
                        ✓ Goal reached — {f(netWorth)} / {f(goal)}
                      </p>
                      <p style={{ fontSize: 12, color: '#2d9e6b' }}>Your net worth has reached this year's target.</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                        <span style={{ color: '#6b6660' }}>{f(netWorth)} of {f(goal)}</span>
                        <span style={{ fontWeight: 700, color: '#2d2a26' }}>{pct.toFixed(0)}% of the way there</span>
                      </div>
                      <div style={{ height: 8, background: '#f0ece4', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(pct, 100)}%`,
                          background: pct >= 75 ? '#7ec8a0' : pct >= 40 ? '#7eb5d6' : '#e8a598',
                          borderRadius: 8, transition: 'width 0.4s',
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Allocation ── */}
      {subTab === 'allocation' && (
        <div>
          {/* Income Sources */}
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
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Inp
                      value={src.label}
                      onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, label: v } : x))}
                      style={{ flex: 2 }}
                    />
                    <Inp
                      type="number"
                      value={src.amount === 0 ? '' : src.amount}
                      onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, amount: v === '' ? 0 : (Number(v) || 0) } : x))}
                      style={{ flex: 2 }}
                      placeholder="0"
                    />
                    <Select
                      value={src.currency || homeCode}
                      onChange={e => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, currency: e.target.value } : x))}
                      style={{ flex: 1 }}
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </Select>
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
                { key: 'benchmarkNeeds', cat: 'Needs', yours: allocByCat['Needs'] || 0, lowerIsBetter: true, barColor: '#E8A838' },
                { key: 'benchmarkWants', cat: 'Wants', yours: allocByCat['Wants'] || 0, lowerIsBetter: true, barColor: '#D96B6B' },
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
                      <div style={{ height: '100%', width: `${Math.min(bench > 0 ? (yours / bench) * 100 : 0, 100)}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
              {totalAllocPct > 100 && <p style={{ fontSize: 11, color: '#c94040', marginTop: 10, background: '#fdf2f2', padding: '6px 10px', borderRadius: 7 }}>⚠ Total: {totalAllocPct.toFixed(1)}% — over 100%</p>}
            </div>
          </div>

          {/* Allocation rules table */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Lbl>ALLOCATION RULES</Lbl>
              <button onClick={() => set('allocation', prev => [...prev, { id: Date.now(), label: 'New Item', category: 'Wants', pct: 0 }])}
                style={{ fontSize: 11, background: 'transparent', border: '1px dashed #d8d4cc', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', color: '#a09890' }}>+ Add row</button>
            </div>
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
                <tr>{['Label', 'Category', '% of Income', 'Monthly Amount', '', ''].map((h, i) => (
                  <th key={i} style={{ padding: '8px 10px', paddingLeft: i === 0 ? 20 : 10, color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {state.allocation.map(row => (
                  <tr
                    key={row.id}
                    draggable
                    onMouseEnter={() => setHoveredRowId(row.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    onDragStart={() => { setDragId(row.id); dragNode.current = row.id; }}
                    onDragOver={e => { e.preventDefault(); setDragOverId(row.id); }}
                    onDrop={() => {
                      if (dragId !== null && dragId !== row.id) {
                        set('allocation', prev => {
                          const next = [...prev];
                          const from = next.findIndex(x => x.id === dragId);
                          const to = next.findIndex(x => x.id === row.id);
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved);
                          return next;
                        });
                      }
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    style={{
                      borderBottom: '1px solid #f9f7f3',
                      borderLeft: `3px solid ${CAT_COLORS[row.category] || '#e8e4dc'}`,
                      borderTop: dragOverId === row.id && dragId !== row.id ? '2px solid #7eb5d6' : undefined,
                      opacity: dragId === row.id ? 0.4 : 1,
                    }}
                  >
                    <td style={{ padding: '5px 10px', paddingLeft: 4 }}>
                      <input
                        value={row.label}
                        onChange={e => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, label: e.target.value } : x))}
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
                    <td style={{ padding: '5px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <select
                          value={row.category}
                          onChange={e => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, category: e.target.value } : x))}
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
                    <td style={{ padding: '5px 10px' }}>
                      <EditableCell
                        value={row.pct === 0 ? '' : row.pct}
                        onChange={v => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, pct: v === '' ? 0 : (Number(v) || 0) } : x))}
                        suffix="%"
                        width={80}
                      />
                    </td>
                    <td style={{ padding: '5px 10px', fontWeight: 500, color: '#4a4643' }}>{f(((Number(row.pct) || 0) / 100) * baseIncome)}</td>
                    <td style={{ padding: '5px 10px' }}><DelBtn onClick={() => set('allocation', prev => prev.filter(x => x.id !== row.id))} /></td>
                    <td style={{ padding: '5px 6px', textAlign: 'center', color: '#d0ccc5', fontSize: 16, cursor: 'grab', userSelect: 'none', opacity: hoveredRowId === row.id ? 1 : 0 }}>⠿</td>
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

          {/* Secondary income allocations (only when >1 source) */}
          {state.incomeSources.length > 1 && (
            <div style={{ ...s.card, marginTop: 16 }}>
              <Lbl>SECONDARY INCOME ALLOCATION</Lbl>
              <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
                Define where your additional income goes. Each rule applies as a % of that specific income source.
              </p>
              {state.incomeSources.slice(1).map(src => {
                const converted = srcToHome(src);
                const rules = (state.secondaryAllocations || {})[src.id] || [];
                const totalPct = rules.reduce((s, r) => s + (Number(r.pct) || 0), 0);
                const isForeign = (src.currency || homeCode) !== homeCode;

                const setRules = (updater) => set('secondaryAllocations', prev => ({
                  ...(prev || {}),
                  [src.id]: typeof updater === 'function' ? updater((prev || {})[src.id] || []) : updater,
                }));

                return (
                  <div key={src.id} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#2d2a26' }}>{src.label}</span>
                      <span style={{ fontSize: 12, color: '#b0aa9f' }}>—</span>
                      <span style={{ fontSize: 12, color: '#6b6660' }}>
                        {isForeign
                          ? `${fLocal(src.amount, src.currency || homeCode)} (${converted !== null ? f(converted) : 'no rate'}) / month`
                          : `${f(Number(src.amount) || 0)} / month`}
                      </span>
                    </div>
                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
                      <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '7%' }} />
                      </colgroup>
                      <thead>
                        <tr>{['Label', 'Category', '% of Source', 'Monthly', ''].map((h, i) => (
                          <th key={i} style={{ padding: '6px 8px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rules.map(rule => (
                          <tr key={rule.id} style={{ borderBottom: '1px solid #f9f7f3', borderLeft: `3px solid ${CAT_COLORS[rule.category] || '#e8e4dc'}` }}>
                            <td style={{ padding: '4px 8px' }}>
                              <Inp value={rule.label} onChange={v => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, label: v } : r))} style={{ width: '100%' }} />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <Select value={rule.category} onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, category: e.target.value } : r))}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                              </Select>
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <EditableCell
                                value={rule.pct === 0 ? '' : rule.pct}
                                onChange={v => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, pct: v === '' ? 0 : (Number(v) || 0) } : r))}
                                suffix="%"
                                width={70}
                              />
                            </td>
                            <td style={{ padding: '4px 8px', fontSize: 12, color: '#4a4643', fontWeight: 500 }}>
                              {converted !== null ? f(((Number(rule.pct) || 0) / 100) * converted) : '—'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <DelBtn onClick={() => setRules(prev => prev.filter(r => r.id !== rule.id))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      onClick={() => setRules(prev => [...prev, { id: Date.now(), label: 'New Rule', category: 'Wants', pct: 0 }])}
                      style={{ fontSize: 11, background: 'transparent', border: '1px dashed #d8d4cc', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', color: '#a09890', marginTop: 6 }}>
                      + Add rule
                    </button>
                    {rules.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}>
                        <span style={{ color: '#9e9890' }}>Total</span>
                        <span style={{ fontWeight: 700, color: totalPct > 100 ? '#c94040' : '#1a1714' }}>
                          {totalPct.toFixed(1)}%
                          {totalPct > 100 && <span style={{ fontSize: 11, color: '#c94040', marginLeft: 6 }}>⚠ over 100%</span>}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
