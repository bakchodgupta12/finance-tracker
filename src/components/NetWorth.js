import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  s, Lbl, Inp, DelBtn, AddBtn, Divider, TypeBadge, ChartTip, Select, fmtChart,
  getCurrency, getCurrencyFlag, ACCOUNT_GROUPS, GROUP_HEADER_STYLES, CURRENCIES
} from '../shared';

export default function NetWorth({
  state, set, f, currency, MONTHS, selectedYear,
  netWorth, accountsNetWorth, totalLiabilities, latestSnapshots,
  toHome, fxRates, fxLoading
}) {
  // Net worth trend chart data
  const chartData = useMemo(() => {
    return MONTHS.map(month => {
      const snap = state.accountSnapshots?.[month];
      if (!snap || !Object.values(snap).some(v => v > 0)) return { month, total: null };
      const total = (state.accounts || []).reduce((sum, acc) => {
        const v = snap[acc.id] || 0;
        const h = toHome(v, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      return { month, total: Math.round(total - totalLiabilities) };
    }).filter(d => d.total !== null);
  }, [MONTHS, state.accountSnapshots, state.accounts, toHome, totalLiabilities]);

  // Detect currencies that need manual rates
  const unsupportedCurrencies = useMemo(() => {
    const homeCurrency = state.currencyCode || 'GBP';
    const usedCurrencies = [...new Set((state.accounts || []).map(a => a.currency))];
    return usedCurrencies.filter(c => c !== homeCurrency && !fxRates[c]);
  }, [state.accounts, fxRates, state.currencyCode]);

  return (
    <div>
      {/* Headline */}
      <div style={{ ...s.card, marginBottom: 16, textAlign: 'center', padding: '28px 24px' }}>
        <Lbl>TOTAL NET WORTH</Lbl>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 42, fontWeight: 500, color: netWorth >= 0 ? '#1a1714' : '#c94040', margin: '8px 0 4px' }}>{f(netWorth)}</p>
        <p style={{ fontSize: 13, color: '#b0aa9f' }}>
          {f(accountsNetWorth)} in accounts — {f(totalLiabilities)} liabilities
          {fxLoading && <span> · loading FX rates…</span>}
        </p>
      </div>

      {/* Manual FX rates for unsupported currencies */}
      {unsupportedCurrencies.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16, background: '#fffbeb', borderColor: '#fde68a' }}>
          <Lbl>MANUAL FX RATES</Lbl>
          <p style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
            These currencies aren't supported by the live rate API. Enter the rate manually (1 unit of currency = X {state.currencyCode || 'GBP'}).
          </p>
          {unsupportedCurrencies.map(cur => (
            <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e', minWidth: 40 }}>{cur}</span>
              <span style={{ fontSize: 12, color: '#b0aa9f' }}>1 {cur} =</span>
              <Inp
                type="number"
                value={state.manualFxRates?.[cur] || ''}
                placeholder="0.00"
                onChange={v => set('manualFxRates', prev => ({ ...prev, [cur]: v }))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: 12, color: '#b0aa9f' }}>{state.currencyCode || 'GBP'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Account Balances */}
      {(() => {
        const latestMonth = (() => {
          for (let i = MONTHS.length - 1; i >= 0; i--) {
            const snap = state.accountSnapshots?.[MONTHS[i]];
            if (snap && Object.values(snap).some(v => v > 0)) return MONTHS[i];
          }
          return null;
        })();
        const accountGroups = ACCOUNT_GROUPS.map(group => ({
          ...group, accounts: (state.accounts || []).filter(a => group.types.includes(a.type)),
        })).filter(g => g.accounts.length > 0);

        return (
          <div style={{ ...s.card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Lbl>ACCOUNT BALANCES</Lbl>
            </div>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Showing most recent month with data{latestMonth ? ` · ${latestMonth} ${selectedYear}` : ''}. Manage accounts in Settings → Accounts.
            </p>

            {(state.accounts || []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#b0aa9f' }}>No accounts set up yet. Add them in Settings → Accounts.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{['Account', 'Type', 'Currency', 'Balance', `In ${state.currencyCode || 'GBP'}`].map((h) => (
                    <th key={h} style={{ padding: '9px 12px', color: '#9e9890', fontSize: 10, letterSpacing: '0.08em', textAlign: 'left', borderBottom: '1px solid #f0ece4', fontWeight: 500 }}>{h.toUpperCase()}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {accountGroups.map(group => {
                    const hdrStyle = GROUP_HEADER_STYLES[group.label] || { background: '#f9f7f3', color: '#9e9890' };
                    const groupTotal = group.accounts.reduce((sum, acc) => {
                      const v = latestSnapshots?.[acc.id] || 0;
                      const h = toHome(v, acc.currency);
                      return sum + (h ?? 0);
                    }, 0);
                    return [
                      <tr key={`hdr-${group.label}`} style={{ background: hdrStyle.background }}>
                        <td colSpan={3} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: hdrStyle.color, background: hdrStyle.background }}>
                          {group.label.toUpperCase()}
                        </td>
                        <td style={{ background: hdrStyle.background, padding: '10px 12px' }} />
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: hdrStyle.color, background: hdrStyle.background, textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {f(groupTotal)}
                        </td>
                      </tr>,
                      ...group.accounts.map(acc => {
                        const localVal = latestSnapshots?.[acc.id] || 0;
                        const accCur = getCurrency(acc.currency);
                        const flag = getCurrencyFlag(acc.currency);
                        const homeVal = toHome(localVal, acc.currency);
                        return (
                          <tr key={acc.id} style={{ borderBottom: '1px solid #f9f7f3' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1a1714' }}>{acc.name}</td>
                            <td style={{ padding: '9px 12px' }}><TypeBadge type={acc.type} /></td>
                            <td style={{ padding: '9px 12px', color: '#9e9890', fontSize: 12 }}>
                              {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{acc.currency}
                            </td>
                            <td style={{ padding: '9px 12px', fontWeight: 500, textAlign: 'left' }}>
                              {localVal > 0 ? `${accCur.symbol}${new Intl.NumberFormat(accCur.locale, { maximumFractionDigits: 0 }).format(localVal)}` : <span style={{ color: '#d5d0c8' }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', color: localVal > 0 ? '#2d2a26' : '#d5d0c8', fontWeight: localVal > 0 ? 600 : 400, textAlign: 'left' }}>
                              {localVal > 0 ? (homeVal !== null ? f(homeVal) : 'Rate unavailable') : '—'}
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
        );
      })()}

      {/* Net worth trend chart */}
      {chartData.length >= 2 ? (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <Lbl>NET WORTH TREND</Lbl>
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7ec8a0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7ec8a0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" />
                <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} />
                <YAxis stroke="#e8e4dc" tick={{ fill: '#b0aa9f', fontSize: 11 }} tickFormatter={v => fmtChart(v, currency.symbol)} />
                <Tooltip content={<ChartTip symbol={currency.symbol} />} />
                <Area type="monotone" dataKey="total" name="Net Worth" stroke="#7ec8a0" fill="url(#nwGrad)" strokeWidth={2} dot={{ fill: '#7ec8a0', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, marginBottom: 16, textAlign: 'center', padding: '24px', color: '#b0aa9f', fontSize: 13 }}>
          Log account snapshots in at least 2 months to see the net worth trend here.
        </div>
      )}

      {/* Liabilities */}
      <div style={s.card}>
        <Lbl>LIABILITIES</Lbl>
        <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>Money you owe. Subtracted from assets to calculate net worth.</p>
        {state.liabilities.map(l => {
          const homeCode = state.currencyCode || 'GBP';
          const lCur = l.currency || homeCode;
          const isForeign = lCur !== homeCode;
          const homeVal = isForeign ? toHome(Number(l.amount) || 0, lCur) : null;
          return (
            <div key={l.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Inp value={l.label} onChange={v => set('liabilities', prev => prev.map(x => x.id === l.id ? { ...x, label: v } : x))} style={{ flex: 2 }} />
                <Inp type="number" value={l.amount === 0 ? '' : l.amount} onChange={v => set('liabilities', prev => prev.map(x => x.id === l.id ? { ...x, amount: v === '' ? 0 : (Number(v) || 0) } : x))} style={{ flex: 1 }} />
                <Select
                  value={lCur}
                  onChange={e => set('liabilities', prev => prev.map(x => x.id === l.id ? { ...x, currency: e.target.value } : x))}
                  style={{ flex: 1 }}
                >
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
                <DelBtn onClick={() => set('liabilities', prev => prev.filter(x => x.id !== l.id))} />
              </div>
              {isForeign && (
                <div style={{ fontSize: 11, color: homeVal !== null ? '#b0aa9f' : '#e8a598', paddingLeft: 4, marginTop: 4, lineHeight: 1.4 }}>
                  {homeVal !== null ? `= ${f(homeVal)} at current rates` : 'no rate available'}
                </div>
              )}
            </div>
          );
        })}
        <AddBtn onClick={() => set('liabilities', prev => [...prev, { id: Date.now(), label: 'New Liability', amount: 0, currency: state.currencyCode || 'GBP' }])} />
        <Divider />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
          <span>
            Total liabilities
            {state.liabilities.some(l => (l.currency || state.currencyCode || 'GBP') !== (state.currencyCode || 'GBP')) && (
              <span style={{ fontSize: 11, color: '#b0aa9f', fontWeight: 400, marginLeft: 6 }}>(converted to {state.currencyCode || 'GBP'})</span>
            )}
          </span>
          <span style={{ color: '#c94040' }}>{f(totalLiabilities)}</span>
        </div>
      </div>
    </div>
  );
}
