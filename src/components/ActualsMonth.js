import { useState } from 'react';
import {
  s, Lbl, Inp, Divider,
  CAT_COLORS, CATEGORIES, ACCOUNT_GROUPS,
  getCurrency, getCurrentMonthAbbr
} from '../shared';

export default function ActualsMonth({
  state, set, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  toHome, selectedYear
}) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthAbbr());

  const getActual = (month, key) => state.actuals[month]?.[key] ?? '';
  const setActual = (month, key, val) => set('actuals', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [key]: val }
  }));
  const getSnap = (month, accId) => state.accountSnapshots?.[month]?.[accId] ?? '';
  const setSnap = (month, accId, val) => set('accountSnapshots', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [accId]: val }
  }));

  const inc = monthIncome(selectedMonth);
  const planned = {
    income: inc,
    Savings: (allocByCat.Savings / 100) * inc,
    Investments: (allocByCat.Investments / 100) * inc,
    Needs: (allocByCat.Needs / 100) * inc,
    Wants: (allocByCat.Wants / 100) * inc,
  };

  const actualIncome = Number(getActual(selectedMonth, 'income')) || 0;
  const currentMonth = getCurrentMonthAbbr();

  // Previous month for % change
  const monthIdx = MONTHS.indexOf(selectedMonth);
  const prevMonth = monthIdx > 0 ? MONTHS[monthIdx - 1] : null;

  // Health score
  const healthScore = (() => {
    const hasData = Object.values(state.actuals[selectedMonth] || {}).some(v => v > 0);
    if (!hasData) return null;

    let offCount = 0;
    CATEGORIES.forEach(cat => {
      const actual = Number(getActual(selectedMonth, cat)) || 0;
      const plan = planned[cat];
      if (cat === 'Savings' || cat === 'Investments') {
        if (actual < plan * 0.9) offCount++;
      } else {
        if (actual > plan * 1.1) offCount++;
      }
    });

    if (offCount === 0) return { label: 'On Track', color: '#2d9e6b', bg: '#f0fdf4', border: '#bbf7d0' };
    if (offCount <= 2) return { label: 'Slightly Off', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    return { label: 'Over Budget', color: '#c94040', bg: '#fdf2f2', border: '#fecaca' };
  })();

  // Account groups
  const accountGroups = ACCOUNT_GROUPS.map(group => {
    const accs = (state.accounts || []).filter(a => group.types.includes(a.type));
    return { ...group, accounts: accs };
  }).filter(g => g.accounts.length > 0);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', marginBottom: 4 }}>Tracker — {selectedYear}</p>
      </div>

      {/* Month pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
        {MONTHS.map(month => (
          <button key={month} onClick={() => setSelectedMonth(month)} style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit',
            border: month === selectedMonth ? '2px solid #2d2a26' : '1px solid #e8e4dc',
            background: month === selectedMonth ? '#2d2a26' : '#fff',
            color: month === selectedMonth ? '#fff' : month === currentMonth ? '#7eb5d6' : '#6b6660',
            cursor: 'pointer', fontWeight: month === selectedMonth || month === currentMonth ? 600 : 400,
          }}>{month}</button>
        ))}
      </div>

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
                // Also set income override if different from base
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
            const plan = planned[cat];
            const actual = Number(getActual(selectedMonth, cat)) || 0;
            const hasActual = getActual(selectedMonth, cat) !== '' && actual > 0;
            const diff = actual - plan;
            const isGood = (cat === 'Savings' || cat === 'Investments') ? actual >= plan : actual <= plan;
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
                    <p style={{ fontSize: 10, color: '#b0aa9f', marginBottom: 2 }}>Actual</p>
                    <Inp type="number" value={getActual(selectedMonth, cat)} placeholder="—"
                      onChange={v => setActual(selectedMonth, cat, v)}
                      style={{ fontSize: 13, fontWeight: 600, padding: '4px 8px' }}
                    />
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: '#f0ece4', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(progress, 100)}%`,
                    background: hasActual ? (isGood ? '#7ec8a0' : '#e8a598') : '#e8e4dc',
                    borderRadius: 4, transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Snapshots */}
      <div style={s.card}>
        <Lbl>ACCOUNT SNAPSHOTS — {selectedMonth.toUpperCase()}</Lbl>
        <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>End-of-month balances. Auto-converts to {state.currencyCode || 'GBP'}.</p>

        {accountGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>{group.label.toUpperCase()}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Account', 'Balance (local)', `In ${state.currencyCode || 'GBP'}`, 'Change'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', color: '#b0aa9f', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.accounts.map(acc => {
                  const localVal = getSnap(selectedMonth, acc.id);
                  const accCur = getCurrency(acc.currency);
                  const numVal = Number(localVal) || 0;
                  const homeVal = localVal !== '' ? toHome(numVal, acc.currency) : null;

                  const prevVal = prevMonth ? (Number(getSnap(prevMonth, acc.id)) || 0) : 0;
                  // pct is a number when computable, 'no-prev' when current exists but no prior data, null when no current data
                  const pct = numVal > 0
                    ? (prevVal > 0 ? ((numVal - prevVal) / prevVal) * 100 : 'no-prev')
                    : null;

                  return (
                    <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 500, color: '#1a1714' }}>{acc.name}</td>
                      <td style={{ padding: '4px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, color: '#b0aa9f' }}>{accCur.symbol}</span>
                          <Inp type="number" value={localVal} placeholder="0"
                            onChange={v => setSnap(selectedMonth, acc.id, v)}
                            style={{ width: 110 }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', color: homeVal === null ? '#d5d0c8' : '#2d2a26', fontWeight: 500 }}>
                        {homeVal === null ? (localVal !== '' ? 'Rate unavailable' : '—') : f(homeVal, true)}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
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
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
