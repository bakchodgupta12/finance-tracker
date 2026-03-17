import { useMemo } from 'react';
import {
  s, Lbl, EditableCell,
  CAT_COLORS, CATEGORIES, ACCOUNT_GROUPS,
  getCurrency, fmt
} from '../shared';

export default function ActualsTable({
  state, set, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
  toHome, selectedYear
}) {
  const getActual = (month, key) => state.actuals[month]?.[key] ?? '';
  const setActual = (month, key, val) => set('actuals', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [key]: val }
  }));
  const getSnap = (month, accId) => state.accountSnapshots?.[month]?.[accId] ?? '';
  const setSnap = (month, accId, val) => set('accountSnapshots', prev => ({
    ...prev, [month]: { ...(prev[month] || {}), [accId]: val }
  }));

  // Group accounts
  const accountGroups = useMemo(() =>
    ACCOUNT_GROUPS.map(group => {
      const accs = (state.accounts || []).filter(a => group.types.includes(a.type));
      return { ...group, accounts: accs };
    }).filter(g => g.accounts.length > 0)
  , [state.accounts]);

  const allAccounts = useMemo(() =>
    accountGroups.flatMap(g => g.accounts)
  , [accountGroups]);

  // Compute month totals in home currency
  const monthHomeTotal = (month) => {
    return allAccounts.reduce((sum, acc) => {
      const v = Number(getSnap(month, acc.id)) || 0;
      const h = toHome(v, acc.currency);
      return sum + (h ?? 0);
    }, 0);
  };

  // Get previous month for % change
  const prevMonth = (month) => {
    const idx = MONTHS.indexOf(month);
    return idx > 0 ? MONTHS[idx - 1] : null;
  };

  const pctChange = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const PctArrow = ({ curr, prev: prevVal }) => {
    const pct = pctChange(curr, prevVal);
    if (pct === null || isNaN(pct)) return null;
    const up = pct >= 0;
    return (
      <span style={{ fontSize: 9, color: up ? '#2d9e6b' : '#c94040', marginLeft: 4, whiteSpace: 'nowrap' }}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
      </span>
    );
  };

  // Year totals & averages
  const yearTotals = useMemo(() => {
    const totals = { income: 0, Savings: 0, Investments: 0, Needs: 0, Wants: 0 };
    let monthsWithData = 0;
    MONTHS.forEach(month => {
      const hasData = Object.values(state.actuals[month] || {}).some(v => v > 0);
      if (hasData) monthsWithData++;
      ['income', ...CATEGORIES].forEach(key => {
        totals[key] += Number(getActual(month, key)) || 0;
      });
    });
    const net = totals.income - totals.Savings - totals.Investments - totals.Needs - totals.Wants;
    return { ...totals, net, monthsWithData };
  }, [state.actuals, MONTHS]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', marginBottom: 4 }}>Actuals — {selectedYear}</p>
        <p style={{ fontSize: 12, color: '#b0aa9f' }}>Full-year view. Click any cell to edit. Grey values show your plan for comparison.</p>
      </div>

      {/* Main actuals table */}
      <div style={{ ...s.card, marginBottom: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Month', 'Income', 'Savings', 'Investments', 'Needs', 'Wants', 'Net'].map(h => (
                <th key={h} style={{
                  padding: '8px 8px', color: '#9e9890', fontSize: 10, letterSpacing: '0.08em',
                  textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHS.map(month => {
              const inc = monthIncome(month);
              const planned = {
                income: inc,
                Savings: (allocByCat.Savings / 100) * inc,
                Investments: (allocByCat.Investments / 100) * inc,
                Needs: (allocByCat.Needs / 100) * inc,
                Wants: (allocByCat.Wants / 100) * inc,
              };

              const actuals = {};
              ['income', ...CATEGORIES].forEach(key => {
                actuals[key] = getActual(month, key);
              });

              const actInc = Number(actuals.income) || 0;
              const actOut = CATEGORIES.reduce((sum, k) => sum + (Number(actuals[k]) || 0), 0);
              const net = actInc > 0 ? actInc - actOut : null;

              return (
                <tr key={month} style={{ borderBottom: '1px solid #f9f7f3' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#4a4643', whiteSpace: 'nowrap' }}>{month}</td>
                  {['income', ...CATEGORIES].map(key => {
                    const val = actuals[key];
                    const plan = planned[key] || 0;
                    const numVal = Number(val) || 0;
                    const hasVal = val !== '' && numVal > 0;
                    const isGood = !hasVal ? null : (key === 'income' || key === 'Savings' || key === 'Investments') ? numVal >= plan : numVal <= plan;

                    return (
                      <td key={key} style={{ padding: '4px 8px', verticalAlign: 'top' }}>
                        <EditableCell
                          value={val}
                          onChange={v => {
                            if (key === 'income' && v !== baseIncome) {
                              set('monthlyIncomeOverrides', prev => {
                                const n = { ...prev };
                                if (!v || v === baseIncome) delete n[month]; else n[month] = v;
                                return n;
                              });
                            }
                            setActual(month, key, v);
                          }}
                          prefix={currency.symbol}
                          width={80}
                        />
                        <p style={{ fontSize: 9, color: '#c0bab2', marginTop: 2, paddingLeft: 2 }}>{f(plan)}</p>
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '6px 8px', fontWeight: 600, fontSize: 12,
                    color: net === null ? '#d5d0c8' : net >= 0 ? '#2d9e6b' : '#c94040'
                  }}>
                    {net === null ? '—' : `${net >= 0 ? '+' : ''}${f(net)}`}
                  </td>
                </tr>
              );
            })}
            {/* Summary row */}
            <tr style={{ borderTop: '2px solid #e8e4dc', background: '#fdfcfa' }}>
              <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 11, color: '#6b6660' }}>TOTAL</td>
              {['income', ...CATEGORIES].forEach(() => {})}
              {['income', ...CATEGORIES].map(key => (
                <td key={key} style={{ padding: '8px 8px', fontWeight: 600, fontSize: 12, color: '#4a4643' }}>
                  {yearTotals[key] > 0 ? f(yearTotals[key]) : '—'}
                </td>
              ))}
              <td style={{
                padding: '8px 8px', fontWeight: 700, fontSize: 12,
                color: yearTotals.net >= 0 ? '#2d9e6b' : '#c94040'
              }}>
                {yearTotals.monthsWithData > 0 ? `${yearTotals.net >= 0 ? '+' : ''}${f(yearTotals.net)}` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Account Snapshots Table */}
      <div style={{ ...s.card, overflowX: 'auto' }}>
        <Lbl>ACCOUNT SNAPSHOTS</Lbl>
        <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>End-of-month balances in local currency. Total column is converted to {state.currencyCode || 'GBP'}.</p>

        {accountGroups.map(group => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>{group.label.toUpperCase()}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', color: '#9e9890', fontSize: 10, textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500, whiteSpace: 'nowrap' }}>MONTH</th>
                  {group.accounts.map(acc => (
                    <th key={acc.id} style={{ padding: '6px 8px', color: '#9e9890', fontSize: 10, textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {acc.name} ({acc.currency})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MONTHS.map(month => {
                  const prev = prevMonth(month);
                  return (
                    <tr key={month} style={{ borderBottom: '1px solid #f9f7f3' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: '#4a4643', whiteSpace: 'nowrap' }}>{month}</td>
                      {group.accounts.map(acc => {
                        const val = getSnap(month, acc.id);
                        const prevVal = prev ? (Number(getSnap(prev, acc.id)) || 0) : 0;
                        const currVal = Number(val) || 0;
                        const accCur = getCurrency(acc.currency);
                        return (
                          <td key={acc.id} style={{ padding: '4px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <EditableCell
                                value={val}
                                onChange={v => setSnap(month, acc.id, v)}
                                prefix={accCur.symbol}
                                width={90}
                              />
                              {currVal > 0 && prev && prevVal > 0 && (
                                <PctArrow curr={currVal} prev={prevVal} />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        {/* Total row per month */}
        <p style={{ fontSize: 11, fontWeight: 600, color: '#9e9890', letterSpacing: '0.1em', marginBottom: 8 }}>MONTHLY TOTALS (HOME CURRENCY)</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px', color: '#9e9890', fontSize: 10, textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>MONTH</th>
              <th style={{ padding: '6px 8px', color: '#9e9890', fontSize: 10, textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>TOTAL ({state.currencyCode || 'GBP'})</th>
              <th style={{ padding: '6px 8px', color: '#9e9890', fontSize: 10, textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>CHANGE</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map(month => {
              const total = monthHomeTotal(month);
              const prev = prevMonth(month);
              const prevTotal = prev ? monthHomeTotal(prev) : 0;
              const hasData = total > 0;
              return (
                <tr key={month} style={{ borderBottom: '1px solid #f9f7f3' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#4a4643' }}>{month}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: hasData ? '#1a1714' : '#d5d0c8' }}>
                    {hasData ? f(total) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {hasData && prev && prevTotal > 0 && (
                      <PctArrow curr={total} prev={prevTotal} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
