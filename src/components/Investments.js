import { useState, useRef } from 'react';
import { s, getCurrencyFlag, DelBtn } from '../shared';

const PILLAR_NAMES = {
  budget: 'Budget',
  investments: 'Investments',
  habits: 'Habits',
};

// ── Date helpers ──────────────────────────────────────────────────────────────
const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

const todayISO = () => new Date().toISOString().split('T')[0];
const genId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtNum   = (n, dp = 2) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: dp }).format(Number(n) || 0);

// ── DateInput (same pattern as ExpenseTracker) ────────────────────────────────
function DateInput({ value, onChange }) {
  const hiddenRef = useRef(null);
  const displayValue =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDisplayDate(value) : value || '';
  const handleTextChange = (e) => {
    const raw   = e.target.value;
    const parts = raw.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      onChange(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      onChange(raw);
    }
  };
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <input
        type="text" value={displayValue} onChange={handleTextChange}
        placeholder="DD-MM-YYYY"
        style={{
          width: 95, background: 'transparent', border: 'none',
          borderBottom: '1px solid #e8e4dc', outline: 'none', fontSize: 13,
          color: '#1a1714', padding: '3px 0', fontFamily: 'inherit',
        }}
      />
      <button
        type="button" onClick={() => hiddenRef.current?.showPicker?.()}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          marginLeft: 3, color: '#b0aa9f', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      <input
        ref={hiddenRef} type="date" value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}

// ── Inline underline-only select (matches allocation table pattern) ────────────
function InlineSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          background: 'transparent', border: 'none',
          borderBottom: '1px solid #e8e4dc', outline: 'none',
          padding: '4px 20px 4px 0', fontSize: 13,
          fontFamily: 'inherit', color: '#1a1714', cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={{
        position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: '#9e9890',
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

// ── Coloured view-mode badges ─────────────────────────────────────────────────
function DepositBadge({ type }) {
  const isDeposit = type === 'deposit';
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: isDeposit ? '#f0faf4' : '#fef2f2',
      color: isDeposit ? '#2d9e6b' : '#c94040',
      fontWeight: 600, letterSpacing: '0.08em',
    }}>
      {isDeposit ? 'Deposit' : 'Withdrawal'}
    </span>
  );
}

function TradeBadge({ action }) {
  const isBuy = action === 'buy';
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: isBuy ? '#f0faf4' : '#fef2f2',
      color: isBuy ? '#2d9e6b' : '#c94040',
      fontWeight: 600, letterSpacing: '0.08em',
    }}>
      {isBuy ? 'Buy' : 'Sell'}
    </span>
  );
}

// ── Shared table styles ───────────────────────────────────────────────────────
const TH = {
  fontSize: 10, color: '#9e9890', fontWeight: 500, letterSpacing: '0.08em',
  padding: '6px 10px', textAlign: 'left',
  borderBottom: '1px solid #f0ece4',
};
const TD = {
  fontSize: 13, color: '#2d2a26', padding: '8px 10px',
  borderBottom: '1px solid #f9f7f3',
};
const inlineInput = {
  background: 'transparent', border: 'none',
  borderBottom: '1px solid #e8e4dc', outline: 'none',
  fontSize: 13, color: '#1a1714', padding: '3px 0', fontFamily: 'inherit',
};
const addBtnStyle = {
  fontSize: 11, background: 'transparent', border: '1px dashed #d8d4cc',
  borderRadius: 7, padding: '5px 12px', cursor: 'pointer', color: '#a09890', marginBottom: 8,
};

// ── Deposits section ──────────────────────────────────────────────────────────
function DepositsSection({ account, deposits, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState({ date: todayISO(), type: 'deposit', amount: '', notes: '' });

  const totalDep = deposits.filter(d => d.type === 'deposit').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalWdr = deposits.filter(d => d.type === 'withdrawal').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const net = totalDep - totalWdr;

  const saveRow = () => {
    if (!row.amount) { setAdding(false); return; }
    onUpdate([...deposits, {
      id: genId(), date: row.date, type: row.type,
      amount: Number(row.amount) || 0, currency: account.currency, notes: row.notes,
    }]);
    setRow({ date: todayISO(), type: 'deposit', amount: '', notes: '' });
    setAdding(false);
  };

  const sorted = [...deposits].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ ...s.card, marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#9e9890', margin: '0 0 4px', textTransform: 'uppercase' }}>Deposits</p>
      <p style={{ fontSize: 12, color: '#9e9890', margin: '0 0 12px' }}>Cash deposited into this account.</p>

      <div style={{ border: '1px solid #e8e4dc', borderRadius: 14, overflow: 'hidden', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Date</th>
              <th style={TH}>Type</th>
              <th style={TH}>Amount</th>
              <th style={TH}>Currency</th>
              <th style={TH}>Notes</th>
              <th style={{ ...TH, width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !adding && (
              <tr><td colSpan={6} style={{ ...TD, color: '#b0aa9f', textAlign: 'center', padding: 20 }}>No deposits yet.</td></tr>
            )}
            {sorted.map(d => (
              <tr key={d.id}>
                <td style={TD}>{formatDisplayDate(d.date)}</td>
                <td style={TD}><DepositBadge type={d.type} /></td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{fmtNum(d.amount)}</td>
                <td style={TD}>{getCurrencyFlag(d.currency)} {d.currency}</td>
                <td style={{ ...TD, color: '#9e9890' }}>{d.notes || '—'}</td>
                <td style={{ ...TD, padding: '4px 6px' }}><DelBtn onClick={() => onUpdate(deposits.filter(x => x.id !== d.id))} /></td>
              </tr>
            ))}
            {adding && (
              <tr style={{ background: '#fafdf9' }}>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <DateInput value={row.date} onChange={v => setRow(r => ({ ...r, date: v }))} />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <InlineSelect
                    value={row.type}
                    onChange={e => setRow(r => ({ ...r, type: e.target.value }))}
                    options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdrawal', label: 'Withdrawal' }]}
                  />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="number" value={row.amount} placeholder="0" autoFocus min="0" step="any"
                    onChange={e => setRow(r => ({ ...r, amount: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    style={{ ...inlineInput, width: 90 }}
                  />
                </td>
                <td style={TD}>{getCurrencyFlag(account.currency)} {account.currency}</td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="text" value={row.notes} placeholder="optional notes"
                    onChange={e => setRow(r => ({ ...r, notes: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    onBlur={saveRow}
                    style={{ ...inlineInput, width: 150 }}
                  />
                </td>
                <td style={{ ...TD, padding: '4px 6px' }}>
                  <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px' }}>×</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button onClick={() => setAdding(true)} style={addBtnStyle}>+ Add Deposit</button>

      <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 12, color: '#6b6660', flexWrap: 'wrap' }}>
        <span>Total deposited: <strong style={{ color: '#2d9e6b' }}>{fmtNum(totalDep)} {account.currency}</strong></span>
        <span>Total withdrawn: <strong style={{ color: '#c94040' }}>{fmtNum(totalWdr)} {account.currency}</strong></span>
        <span>Net: <strong style={{ color: net >= 0 ? '#2d9e6b' : '#c94040' }}>{fmtNum(net)} {account.currency}</strong></span>
      </div>
    </div>
  );
}

// ── Trades section ────────────────────────────────────────────────────────────
function TradesSection({ account, trades, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState({ date: todayISO(), action: 'buy', asset: '', quantity: '', price: '', notes: '' });

  const isCrypto      = account.type === 'Crypto';
  const isIndiaEquity = account.type === 'Investment' && account.currency === 'INR';
  const assetLabel    = isCrypto ? 'Asset' : isIndiaEquity ? 'Stock/Fund' : 'Ticker';

  const totalBought = trades.filter(t => t.action === 'buy').reduce((s, t) => s + (Number(t.total) || 0), 0);
  const totalSold   = trades.filter(t => t.action === 'sell').reduce((s, t) => s + (Number(t.total) || 0), 0);

  const saveRow = () => {
    if (!row.asset || !row.quantity || !row.price) { setAdding(false); return; }
    const qty   = Number(row.quantity) || 0;
    const price = Number(row.price)    || 0;
    const asset = (!isCrypto && !isIndiaEquity) ? row.asset.toUpperCase() : row.asset;
    onUpdate([...trades, {
      id: genId(), date: row.date, action: row.action, asset,
      quantity: qty, price, total: qty * price, currency: account.currency, notes: row.notes,
    }]);
    setRow({ date: todayISO(), action: 'buy', asset: '', quantity: '', price: '', notes: '' });
    setAdding(false);
  };

  const previewTotal = row.quantity && row.price
    ? fmtNum((Number(row.quantity) || 0) * (Number(row.price) || 0))
    : '—';

  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
  const qtyDp  = isCrypto ? 8 : 4;

  return (
    <div style={{ ...s.card, marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#9e9890', margin: '0 0 4px', textTransform: 'uppercase' }}>Trades</p>
      <p style={{ fontSize: 12, color: '#9e9890', margin: '0 0 2px' }}>Assets bought and sold in this account.</p>
      <p style={{ fontSize: 11, color: '#b0aa9f', margin: '0 0 12px' }}>All amounts in {account.currency}</p>

      <div style={{ border: '1px solid #e8e4dc', borderRadius: 14, overflow: 'auto', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={TH}>Date</th>
              <th style={TH}>Action</th>
              <th style={TH}>{assetLabel}</th>
              <th style={TH}>Quantity</th>
              <th style={TH}>Price</th>
              <th style={TH}>Total</th>
              <th style={TH}>Notes</th>
              <th style={{ ...TH, width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !adding && (
              <tr><td colSpan={8} style={{ ...TD, color: '#b0aa9f', textAlign: 'center', padding: 20 }}>No trades yet.</td></tr>
            )}
            {sorted.map(t => (
              <tr key={t.id}>
                <td style={TD}>{formatDisplayDate(t.date)}</td>
                <td style={TD}><TradeBadge action={t.action} /></td>
                <td style={{ ...TD, fontWeight: 600 }}>{t.asset}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{fmtNum(t.quantity, qtyDp)}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{fmtNum(t.price)}</td>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 500 }}>{fmtNum(t.total)}</td>
                <td style={{ ...TD, color: '#9e9890' }}>{t.notes || '—'}</td>
                <td style={{ ...TD, padding: '4px 6px' }}><DelBtn onClick={() => onUpdate(trades.filter(x => x.id !== t.id))} /></td>
              </tr>
            ))}
            {adding && (
              <tr style={{ background: '#f0f7ff' }}>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <DateInput value={row.date} onChange={v => setRow(r => ({ ...r, date: v }))} />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <InlineSelect
                    value={row.action}
                    onChange={e => setRow(r => ({ ...r, action: e.target.value }))}
                    options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
                  />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="text" value={row.asset} placeholder={assetLabel} autoFocus
                    onChange={e => setRow(r => ({
                      ...r,
                      asset: (!isCrypto && !isIndiaEquity) ? e.target.value.toUpperCase() : e.target.value,
                    }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    style={{ ...inlineInput, width: 80 }}
                  />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="number" value={row.quantity} placeholder="0" min="0" step="any"
                    onChange={e => setRow(r => ({ ...r, quantity: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    style={{ ...inlineInput, width: 80 }}
                  />
                </td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="number" value={row.price} placeholder="0.00" min="0" step="any"
                    onChange={e => setRow(r => ({ ...r, price: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    style={{ ...inlineInput, width: 80 }}
                  />
                </td>
                <td style={{ ...TD, color: '#9e9890', fontFamily: 'monospace' }}>{previewTotal}</td>
                <td style={{ ...TD, padding: '6px 10px' }}>
                  <input
                    type="text" value={row.notes} placeholder="optional"
                    onChange={e => setRow(r => ({ ...r, notes: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveRow(); if (e.key === 'Escape') setAdding(false); }}
                    onBlur={saveRow}
                    style={{ ...inlineInput, width: 100 }}
                  />
                </td>
                <td style={{ ...TD, padding: '4px 6px' }}>
                  <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px' }}>×</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button onClick={() => setAdding(true)} style={addBtnStyle}>+ Add Trade</button>

      <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 12, color: '#6b6660', flexWrap: 'wrap' }}>
        <span>Total bought: <strong style={{ color: '#2d9e6b' }}>{fmtNum(totalBought)} {account.currency}</strong></span>
        <span>Total sold: <strong style={{ color: '#c94040' }}>{fmtNum(totalSold)} {account.currency}</strong></span>
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({
  investmentAccounts, investmentDeposits, investmentTrades,
  accountSnapshots, MONTHS,
}) {
  const [hoveredNoBalance, setHoveredNoBalance] = useState(null);

  const getLatestBalance = (accId) => {
    if (!accountSnapshots || !MONTHS) return null;
    for (let i = MONTHS.length - 1; i >= 0; i--) {
      const snap = accountSnapshots[MONTHS[i]];
      if (snap && snap[accId] !== undefined && snap[accId] !== null && snap[accId] !== 0) {
        return snap[accId];
      }
    }
    return null;
  };

  return (
    <div>
      <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', margin: '0 0 4px' }}>Investment Accounts</p>
      <p style={{ fontSize: 13, color: '#9e9890', margin: '0 0 20px' }}>Summary of all your investment accounts and activity.</p>

      {investmentAccounts.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '32px 24px' }}>
          <p style={{ fontSize: 13, color: '#9e9890', lineHeight: 1.6 }}>
            No investment accounts found. Add accounts in{' '}
            <strong>{PILLAR_NAMES.budget} → Settings → Accounts</strong> and set their type to Investment or Crypto.
          </p>
        </div>
      ) : (
        <>
          <div style={{ ...s.card, padding: 0, overflow: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={TH}>Account</th>
                  <th style={TH}>Currency</th>
                  <th style={TH}>Latest Balance</th>
                  <th style={TH}>Total Deposited</th>
                  <th style={TH}>Total Deployed</th>
                </tr>
              </thead>
              <tbody>
                {investmentAccounts.map(acc => {
                  const deps           = investmentDeposits[acc.id] || [];
                  const trs            = investmentTrades[acc.id]   || [];
                  const totalDeposited = deps.filter(d => d.type === 'deposit').reduce((s, d) => s + (Number(d.amount) || 0), 0);
                  const totalDeployed  = trs.filter(t => t.action === 'buy').reduce((s, t) => s + (Number(t.total) || 0), 0);
                  const latestBal      = getLatestBalance(acc.id);

                  return (
                    <tr key={acc.id}>
                      <td style={{ ...TD, fontWeight: 500 }}>{acc.name}</td>
                      <td style={TD}>{getCurrencyFlag(acc.currency)} {acc.currency}</td>
                      <td style={{ ...TD }}>
                        {latestBal !== null ? (
                          <span style={{ fontFamily: 'monospace' }}>{fmtNum(latestBal)}</span>
                        ) : (
                          <span
                            style={{ position: 'relative', display: 'inline-block' }}
                            onMouseEnter={() => setHoveredNoBalance(acc.id)}
                            onMouseLeave={() => setHoveredNoBalance(null)}
                          >
                            <span style={{ color: '#b0aa9f', cursor: 'default' }}>—</span>
                            {hoveredNoBalance === acc.id && (
                              <div style={{
                                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
                                background: '#2d2a26', color: '#fff', fontSize: 11,
                                padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', pointerEvents: 'none', zIndex: 10,
                              }}>
                                Log balances in {PILLAR_NAMES.budget} → Tracker → Balances
                              </div>
                            )}
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, fontFamily: 'monospace' }}>{fmtNum(totalDeposited)}</td>
                      <td style={{ ...TD, fontFamily: 'monospace' }}>{fmtNum(totalDeployed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Investments Settings tab ──────────────────────────────────────────────────
function InvestmentsSettingsTab({ allInvestmentAccounts, investmentAccountVisibility, onToggleVisibility }) {
  const isVisible = (id) => {
    const v = investmentAccountVisibility?.[id];
    return v === undefined || v === true;
  };

  return (
    <div>
      {/* Visibility section */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#9e9890', margin: '0 0 4px', textTransform: 'uppercase' }}>Accounts in Investments</p>
        <p style={{ fontSize: 13, color: '#9e9890', margin: '0 0 16px' }}>
          Choose which accounts appear as tabs in the Investments pillar.
        </p>

        {allInvestmentAccounts.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9e9890' }}>No investment accounts. Add them in {PILLAR_NAMES.budget} → Settings → Accounts.</p>
        ) : (
          <>
            {allInvestmentAccounts.map((acc, i) => {
              const visible = isVisible(acc.id);
              return (
                <div key={acc.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < allInvestmentAccounts.length - 1 ? '1px solid #f0ece4' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, color: '#1a1714' }}>{acc.name}</span>
                    <span style={{ fontSize: 12, color: '#9e9890' }}>{getCurrencyFlag(acc.currency)} {acc.currency}</span>
                  </div>
                  {/* Toggle switch */}
                  <div
                    onClick={() => onToggleVisibility(acc.id)}
                    style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: visible ? '#5B9BD5' : '#e8e4dc',
                      cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2,
                      left: visible ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: '#b0aa9f', margin: '12px 0 0' }}>
              To add or remove accounts, go to {PILLAR_NAMES.budget} → Settings → Accounts
            </p>
          </>
        )}
      </div>

      {/* Base currency note */}
      <div style={{ ...s.card }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#9e9890', marginBottom: 4, textTransform: 'uppercase' }}>Base Currency</p>
        <p style={{ fontSize: 13, color: '#9e9890', margin: 0 }}>
          Investment totals are shown in each account's local currency. No conversion is applied.
        </p>
      </div>
    </div>
  );
}

// ── Main Investments export ───────────────────────────────────────────────────
export default function Investments({
  state, set, subTab,
  allInvestmentAccounts, visibleInvestmentAccounts,
  accountSnapshots, MONTHS,
}) {
  const deposits          = state.investmentDeposits          || {};
  const trades            = state.investmentTrades            || {};
  const accountVisibility = state.investmentAccountVisibility || {};

  const updateDeposits = (accountId, newDeposits) =>
    set('investmentDeposits', prev => ({ ...(prev || {}), [accountId]: newDeposits }));

  const updateTrades = (accountId, newTrades) =>
    set('investmentTrades', prev => ({ ...(prev || {}), [accountId]: newTrades }));

  const toggleVisibility = (accountId) => {
    set('investmentAccountVisibility', prev => {
      const p = prev || {};
      const current = p[accountId] === undefined ? true : p[accountId];
      return { ...p, [accountId]: !current };
    });
  };

  const activeAccount = visibleInvestmentAccounts.find(a => String(a.id) === subTab) || null;

  return (
    <div>
      {subTab === 'overview' && (
        <OverviewTab
          investmentAccounts={visibleInvestmentAccounts}
          investmentDeposits={deposits}
          investmentTrades={trades}
          accountSnapshots={accountSnapshots}
          MONTHS={MONTHS}
        />
      )}

      {activeAccount && (
        <div>
          <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', margin: '0 0 4px' }}>
            {activeAccount.name}
          </p>
          <p style={{ fontSize: 13, color: '#9e9890', margin: '0 0 20px' }}>
            {activeAccount.type} account · {getCurrencyFlag(activeAccount.currency)} {activeAccount.currency}
          </p>

          <DepositsSection
            account={activeAccount}
            deposits={deposits[activeAccount.id] || []}
            onUpdate={d => updateDeposits(activeAccount.id, d)}
          />

          <TradesSection
            account={activeAccount}
            trades={trades[activeAccount.id] || []}
            onUpdate={t => updateTrades(activeAccount.id, t)}
          />
        </div>
      )}

      {subTab === 'settings' && (
        <InvestmentsSettingsTab
          allInvestmentAccounts={allInvestmentAccounts}
          investmentAccountVisibility={accountVisibility}
          onToggleVisibility={toggleVisibility}
        />
      )}
    </div>
  );
}
