import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, Inp, DelBtn, AddBtn, Divider, Tag,
  CAT_COLORS, CATEGORIES, CURRENCIES,
  getCurrency, fmt
} from '../shared';

const SUB_TABS = [
  { id: 'income', label: 'Income' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'subscriptions', label: 'Subscriptions' },
];

export default function Plan({ state, set, f, currency, baseIncome, allocByCat, totalAllocPct }) {
  const [subTab, setSubTab] = useState('income');

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e4dc' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: subTab === t.id ? '2px solid #2d2a26' : '2px solid transparent',
            color: subTab === t.id ? '#1a1714' : '#a09890',
            cursor: 'pointer', padding: '10px 16px',
            fontSize: 12, fontWeight: subTab === t.id ? 600 : 400,
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Income ── */}
      {subTab === 'income' && (
        <div style={{ maxWidth: 560 }}>
          <div style={s.card}>
            <Lbl>MONTHLY INCOME SOURCES</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Base income each month. Individual months can be overridden in the Actuals tab.
            </p>
            {state.incomeSources.map(src => (
              <div key={src.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Inp value={src.label} onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                <span style={{ color: '#b0aa9f', fontSize: 13 }}>{currency.symbol}</span>
                <Inp type="number" value={src.amount} onChange={v => set('incomeSources', prev => prev.map(x => x.id === src.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                <DelBtn onClick={() => set('incomeSources', prev => prev.filter(x => x.id !== src.id))} />
              </div>
            ))}
            <AddBtn onClick={() => set('incomeSources', prev => [...prev, { id: Date.now(), label: 'New Source', amount: 0 }])} />
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b6660' }}>Total base monthly income</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{f(baseIncome)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocation ── */}
      {subTab === 'allocation' && (
        <div>
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
              <p style={{ fontSize: 11, color: '#b0aa9f', marginBottom: 12 }}>Set your target percentages. Default is 50/30/20.</p>
              {[
                { key: 'benchmarkNeeds', cat: 'Needs', yours: allocByCat['Needs'] || 0, lowerIsBetter: true },
                { key: 'benchmarkWants', cat: 'Wants', yours: allocByCat['Wants'] || 0, lowerIsBetter: true },
                { key: 'benchmarkSavingsInvest', cat: 'Savings + Invest', yours: (allocByCat['Savings'] || 0) + (allocByCat['Investments'] || 0), lowerIsBetter: false },
              ].map(({ key, cat, yours, lowerIsBetter }) => {
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
                          value={bench}
                          onChange={e => set(key, parseFloat(e.target.value) || 0)}
                          style={{ ...s.input, width: 42, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                        />
                        <span style={{ color: '#b0aa9f', fontSize: 10 }}>%</span>
                      </div>
                      <span style={{ color: ok ? '#2d9e6b' : '#c94040', fontWeight: 600 }}>{yours.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(bench > 0 ? (yours / bench) * 100 : 0, 100)}%`, background: ok ? '#7ec8a0' : '#e8a598', borderRadius: 4, transition: 'width 0.4s' }} />
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['Label', 'Category', '% of Income', 'Monthly Amount', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {state.allocation.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                    <td style={{ padding: '5px 10px' }}><Inp value={row.label} onChange={v => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, label: v } : x))} style={{ width: 160 }} /></td>
                    <td style={{ padding: '5px 10px' }}>
                      <select value={row.category} onChange={e => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, category: e.target.value } : x))} style={{ ...s.input, width: 'auto' }}>
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Inp type="number" value={row.pct} onChange={v => set('allocation', prev => prev.map(x => x.id === row.id ? { ...x, pct: v } : x))} style={{ width: 65, textAlign: 'right' }} />
                        <span style={{ color: '#b0aa9f' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '5px 10px', fontWeight: 500, color: '#4a4643' }}>{f((row.pct / 100) * baseIncome, true)}</td>
                    <td style={{ padding: '5px 10px' }}><DelBtn onClick={() => set('allocation', prev => prev.filter(x => x.id !== row.id))} /></td>
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

      {/* ── Subscriptions ── */}
      {subTab === 'subscriptions' && (
        <div style={{ maxWidth: 560 }}>
          <div style={s.card}>
            <Lbl>FIXED MONTHLY COSTS</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Recurring subscriptions and fixed costs. These feed into your Needs category context.
            </p>
            {state.subscriptions.map(sub => (
              <div key={sub.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Inp value={sub.label} onChange={v => set('subscriptions', prev => prev.map(x => x.id === sub.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                <span style={{ color: '#b0aa9f', fontSize: 13 }}>{currency.symbol}</span>
                <Inp type="number" value={sub.amount} onChange={v => set('subscriptions', prev => prev.map(x => x.id === sub.id ? { ...x, amount: v } : x))} style={{ flex: 1, textAlign: 'right' }} />
                <DelBtn onClick={() => set('subscriptions', prev => prev.filter(x => x.id !== sub.id))} />
              </div>
            ))}
            <AddBtn onClick={() => set('subscriptions', prev => [...prev, { id: Date.now(), label: 'New Subscription', amount: 0 }])} />
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#6b6660' }}>Total / month</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{f(state.subscriptions.reduce((sum, x) => sum + x.amount, 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
