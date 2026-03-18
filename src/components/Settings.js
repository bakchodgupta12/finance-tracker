import { useState, useEffect } from 'react';
import { hashPassword, verifyPassword } from '../supabase';
import {
  s, Lbl, Inp, FG, Toast, Divider, DelBtn, AddBtn, TypeBadge, Select,
  CURRENCIES, ACCOUNT_TYPES, ALL_MONTHS, capitalize,
  EXPENSE_CATEGORY_COLORS, fmt, getCurrency,
} from '../shared';

const SUB_TABS = [
  { id: 'profile',    label: 'Profile' },
  { id: 'modules',    label: 'Modules' },
  { id: 'accounts',   label: 'Accounts' },
  { id: 'categories', label: 'Categories' },
  { id: 'payment',    label: 'Payment' },
  { id: 'security',   label: 'Security' },
  { id: 'danger',     label: 'Danger' },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, desc }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#2d2a26', marginBottom: desc ? 2 : 0 }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: '#b0aa9f' }}>{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: checked ? '#2d2a26' : '#e8e4dc', position: 'relative',
          transition: 'background 0.2s', flexShrink: 0, outline: 'none',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default function Settings({ state, set, onDeleteAccount, onLogout, settingsTargetSubTab, setSettingsTargetSubTab, navigate }) {
  const [subTab,     setSubTab]     = useState('profile');

  useEffect(() => {
    if (settingsTargetSubTab) {
      setSubTab(settingsTargetSubTab);
      setSettingsTargetSubTab(null);
    }
  }, [settingsTargetSubTab, setSettingsTargetSubTab]); // eslint-disable-line
  const [oldPw,      setOldPw]      = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [cPw,        setCPw]        = useState('');
  const [pwMsg,      setPwMsg]      = useState(null);
  const [busyPw,     setBusyPw]     = useState(false);
  const [delText,    setDelText]    = useState('');
  const [delConfirm, setDelConfirm] = useState(false);
  // Color picker open state (category id or null)
  const [colorPickId, setColorPickId] = useState(null);

  const expenses       = state.expenses        || [];
  const categories     = state.expenseCategories || [];
  const paymentMethods = state.paymentMethods  || [];
  const modules        = state.modules         || { income: true, expenses: true, trades: true };

  const setModule = (key, val) => set('modules', prev => ({ ...(prev || {}), [key]: val }));

  const isCatInUse = name => expenses.some(e => e.category === name);

  const changePw = async () => {
    setPwMsg(null);
    if (!oldPw) { setPwMsg({ text: 'Enter your current password.', type: 'error' }); return; }
    if (newPw.length < 4) { setPwMsg({ text: 'New password must be 4+ characters.', type: 'error' }); return; }
    if (newPw !== cPw) { setPwMsg({ text: 'Passwords do not match.', type: 'error' }); return; }
    setBusyPw(true);
    const ok = await verifyPassword(state.userId, oldPw);
    if (!ok) { setPwMsg({ text: 'Current password incorrect.', type: 'error' }); setBusyPw(false); return; }
    const h = await hashPassword(newPw);
    set('passwordHash', h);
    setOldPw(''); setNewPw(''); setCPw('');
    setPwMsg({ text: 'Password updated.', type: 'success' });
    setBusyPw(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 20, color: '#1a1714', marginBottom: 4 }}>Settings</p>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e4dc', overflowX: 'auto' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: subTab === t.id ? '2px solid #2d2a26' : '2px solid transparent',
            color: subTab === t.id ? '#1a1714' : (t.id === 'danger' ? '#c94040' : '#a09890'),
            cursor: 'pointer', padding: '12px 16px', whiteSpace: 'nowrap',
            fontSize: 13, fontWeight: subTab === t.id ? 600 : 400,
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Profile ── */}
      {subTab === 'profile' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <FG label="DISPLAY NAME">
              <Inp value={state.displayName || ''} onChange={v => set('displayName', v)} placeholder={capitalize(state.userId)} />
              <p style={{ fontSize: 11, color: '#b0aa9f', marginTop: 4 }}>Shown in the greeting. Blank = username.</p>
            </FG>
            <FG label="HOME CURRENCY">
              <Select value={state.currencyCode || 'GBP'} onChange={e => set('currencyCode', e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
              </Select>
            </FG>
            <FG label="FINANCIAL YEAR STARTS">
              <Select value={state.yearStartMonth ?? 0} onChange={e => set('yearStartMonth', Number(e.target.value))}>
                {ALL_MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}{i === 0 ? ' (Calendar year)' : i === 3 ? ' (UK tax year)' : ''}</option>
                ))}
              </Select>
            </FG>
            {/* FX API usage counter — admin only */}
            {state.userId === 'shishir' && (() => {
              const count = (state.fxApiCallsThisMonth || {}).count || 0;
              const color = count >= 1400 ? '#D96B6B' : count >= 1000 ? '#E8A838' : '#2d9e6b';
              return (
                <p style={{ fontSize: 12, color, marginTop: 12, fontWeight: 500 }}>
                  FX API calls this month: {count} / 1,500
                  {count >= 1400 && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#D96B6B', marginTop: 2 }}>Approaching free tier limit. Rates may fall back to backup source.</span>}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Modules ── */}
      {subTab === 'modules' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <Lbl>MODULES</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 20 }}>
              Toggle features on or off. Toggling off hides the tab but does not delete any data.
            </p>
            <Toggle
              label="Income Tracker"
              desc="Log and categorise your monthly income"
              checked={!!modules.income}
              onChange={v => setModule('income', v)}
            />
            <Toggle
              label="Expense Tracker"
              desc="Track every transaction with categories"
              checked={!!modules.expenses}
              onChange={v => setModule('expenses', v)}
            />
            <Toggle
              label="Trades Tracker"
              desc="Monitor your investments and trades"
              checked={!!modules.trades}
              onChange={v => setModule('trades', v)}
            />
          </div>
        </div>
      )}

      {/* ── Accounts ── */}
      {subTab === 'accounts' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Define your bank and investment accounts here. These appear across Actuals and Net Worth tabs.
            </p>
            {(state.accounts || []).map(acc => (
              <div key={acc.id} style={{ background: '#f9f7f3', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f0ece4' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <Inp value={acc.name} onChange={v => set('accounts', prev => prev.map(a => a.id === acc.id ? { ...a, name: v } : a))}
                    placeholder="Account name" style={{ flex: 2 }} />
                  <DelBtn onClick={() => set('accounts', prev => prev.filter(a => a.id !== acc.id))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select value={acc.type} onChange={e => set('accounts', prev => prev.map(a => a.id === acc.id ? { ...a, type: e.target.value } : a))}
                    style={{ flex: 1 }}>
                    {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </Select>
                  <Select value={acc.currency} onChange={e => set('accounts', prev => prev.map(a => a.id === acc.id ? { ...a, currency: e.target.value } : a))}
                    style={{ flex: 1 }}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </Select>
                </div>
              </div>
            ))}
            <AddBtn onClick={() => set('accounts', prev => [...(prev || []), { id: Date.now(), name: 'New Account', type: 'Bank', currency: 'GBP', note: '' }])}
              label="+ Add account" />
          </div>
        </div>
      )}

      {/* ── Expense Categories ── */}
      {subTab === 'categories' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <Lbl>EXPENSE CATEGORIES</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Used in the Expenses tracker.
            </p>
            {categories.map(cat => {
              const inUse = isCatInUse(cat.name);
              const isPickerOpen = colorPickId === cat.id;
              return (
                <div key={cat.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Color dot */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={() => setColorPickId(isPickerOpen ? null : cat.id)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', background: cat.color,
                          border: '2px solid #e8e4dc', cursor: 'pointer', flexShrink: 0,
                          display: 'block', outline: 'none',
                        }}
                      />
                      {isPickerOpen && (
                        <div style={{
                          position: 'absolute', top: 28, left: 0, zIndex: 20,
                          background: '#fff', border: '1px solid #e8e4dc', borderRadius: 10,
                          padding: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          display: 'flex', flexWrap: 'wrap', gap: 6, width: 136,
                        }}>
                          {EXPENSE_CATEGORY_COLORS.map(col => (
                            <button
                              key={col}
                              onClick={() => {
                                set('expenseCategories', prev => prev.map(c => c.id === cat.id ? { ...c, color: col } : c));
                                setColorPickId(null);
                              }}
                              style={{
                                width: 22, height: 22, borderRadius: '50%', background: col, border: 'none',
                                cursor: 'pointer', outline: cat.color === col ? '2px solid #2d2a26' : 'none',
                                outlineOffset: 2,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <Inp
                      value={cat.name}
                      onChange={v => set('expenseCategories', prev => prev.map(c => c.id === cat.id ? { ...c, name: v } : c))}
                      style={{ flex: 1 }}
                    />
                    {/* Need/Want type */}
                    <Select
                      value={cat.type || ''}
                      onChange={e => set('expenseCategories', prev => prev.map(c => c.id === cat.id ? { ...c, type: e.target.value || null } : c))}
                      style={{ width: 90, fontSize: 12 }}
                    >
                      <option value="">—</option>
                      <option value="Need">Need</option>
                      <option value="Want">Want</option>
                    </Select>
                    {/* Delete */}
                    {inUse ? (
                      <span title="Remove from expenses first" style={{ fontSize: 12, color: '#d5d0c8', cursor: 'not-allowed', padding: '0 4px' }}>×</span>
                    ) : (
                      <DelBtn onClick={() => set('expenseCategories', prev => prev.filter(c => c.id !== cat.id))} />
                    )}
                  </div>
                </div>
              );
            })}
            <AddBtn onClick={() => {
              const nextColor = EXPENSE_CATEGORY_COLORS[categories.length % EXPENSE_CATEGORY_COLORS.length];
              set('expenseCategories', prev => [...(prev || []), { id: Date.now(), name: 'New Category', color: nextColor, type: null }]);
            }} label="+ Add category" />
          </div>
        </div>
      )}

      {/* ── Payment Methods ── */}
      {subTab === 'payment' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <Lbl>PAYMENT METHODS</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Your cards and payment accounts used in Expenses.
            </p>
            {paymentMethods.length === 0 && (
              <p style={{ fontSize: 13, color: '#b0aa9f', marginBottom: 12 }}>Add the cards and accounts you pay with.</p>
            )}
            {paymentMethods.map(pm => (
              <div key={pm.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Inp
                  value={pm.name}
                  onChange={v => set('paymentMethods', prev => prev.map(p => p.id === pm.id ? { ...p, name: v } : p))}
                  placeholder="e.g. HSBC Credit Card"
                  style={{ flex: 1 }}
                />
                <DelBtn onClick={() => set('paymentMethods', prev => prev.filter(p => p.id !== pm.id))} />
              </div>
            ))}
            <AddBtn onClick={() => set('paymentMethods', prev => [...(prev || []), { id: Date.now(), name: '' }])}
              label="+ Add payment method" />
          </div>

          {/* ── Recurring From Expenses ── */}
          <div style={{ ...s.card, marginTop: 14 }}>
            <Lbl>RECURRING FROM EXPENSES</Lbl>
            <p style={{ fontSize: 12, color: '#b0aa9f', marginBottom: 16 }}>
              Automatically tracked from expenses you've marked as recurring.
            </p>
            {(() => {
              const recurring = expenses.filter(e => e.recurring);
              if (recurring.length === 0) {
                return (
                  <p style={{ fontSize: 13, color: '#b0aa9f' }}>
                    Mark expenses as recurring in the Tracker to see them here.
                  </p>
                );
              }
              const cur = getCurrency(state.currencyCode || 'GBP');
              const f = (v) => fmt(v, cur.symbol, cur.locale);
              const monthly = recurring.filter(e => !e.recurringFrequency || e.recurringFrequency === 'monthly');
              const yearly  = recurring.filter(e => e.recurringFrequency === 'yearly');
              const totalMonthly = monthly.reduce((s, e) => s + (Number(e.amount) || 0), 0)
                                 + yearly.reduce((s, e) => s + ((Number(e.amount) || 0) / 12), 0);
              const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
              const viewBtn  = { fontSize: 11, color: '#7eb5d6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' };
              return (
                <>
                  {monthly.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, color: '#b0aa9f', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>MONTHLY</p>
                      {monthly.map((e, i) => (
                        <div key={i} style={rowStyle}>
                          <span style={{ fontSize: 13, color: '#4a4643' }}>{e.description || '(unnamed)'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: '#1a1714', fontWeight: 500 }}>{f(Number(e.amount) || 0)} / month</span>
                            <button onClick={() => navigate?.('tracker', 'expenses')} style={viewBtn}>View in Expenses →</button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {yearly.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, color: '#b0aa9f', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8, marginTop: monthly.length > 0 ? 14 : 0 }}>YEARLY</p>
                      {yearly.map((e, i) => (
                        <div key={i} style={rowStyle}>
                          <span style={{ fontSize: 13, color: '#4a4643' }}>{e.description || '(unnamed)'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: '#1a1714', fontWeight: 500 }}>
                              {f(Number(e.amount) || 0)} / year
                              <span style={{ fontSize: 11, color: '#b0aa9f', marginLeft: 4 }}>({f((Number(e.amount) || 0) / 12)} / mo)</span>
                            </span>
                            <button onClick={() => navigate?.('tracker', 'expenses')} style={viewBtn}>View in Expenses →</button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{ borderTop: '1px solid #f0ece4', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#9e9890' }}>Total monthly recurring</span>
                    <span style={{ fontWeight: 700, color: '#1a1714' }}>{f(totalMonthly)} / month</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Security ── */}
      {subTab === 'security' && (
        <div style={{ maxWidth: 680 }}>
          <div style={s.card}>
            <p style={{ fontSize: 13, color: '#6b6660', marginBottom: 20 }}>Logged in as <strong>{state.userId}</strong></p>
            <Lbl>CHANGE PASSWORD</Lbl>
            <div style={{ marginTop: 12 }}>
              <FG label="CURRENT PASSWORD"><Inp type="password" value={oldPw} onChange={setOldPw} placeholder="Current password" /></FG>
              <FG label="NEW PASSWORD"><Inp type="password" value={newPw} onChange={setNewPw} placeholder="At least 4 characters" /></FG>
              <FG label="CONFIRM NEW PASSWORD"><Inp type="password" value={cPw} onChange={setCPw} placeholder="Repeat" /></FG>
              {pwMsg && <Toast msg={pwMsg.text} type={pwMsg.type} />}
              <button onClick={changePw} disabled={busyPw} style={s.btn}>{busyPw ? 'Saving…' : 'Update password'}</button>
            </div>
            <Divider />
            <Lbl>SECURITY QUESTION</Lbl>
            <div style={{ background: '#f9f7f3', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#6b6660', marginTop: 8 }}>
              {state.securityQuestion || 'No security question set.'}
            </div>
            <Divider />
            <button onClick={onLogout} style={s.btnSec}>Log out</button>
          </div>
        </div>
      )}

      {/* ── Danger ── */}
      {subTab === 'danger' && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ ...s.card, background: '#fdf2f2', borderColor: '#fecaca' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#c94040', marginBottom: 8 }}>Delete Account</p>
            <p style={{ fontSize: 13, color: '#6b6660', marginBottom: 16 }}>
              This will permanently delete your account and all associated data across all years. This action cannot be undone.
            </p>
            {!delConfirm ? (
              <button onClick={() => setDelConfirm(true)} style={s.btnDanger}>Delete my account &amp; all data</button>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: '#6b6660', marginBottom: 10 }}>Type <strong>DELETE</strong> to confirm:</p>
                <Inp value={delText} onChange={setDelText} placeholder="DELETE" style={{ marginBottom: 10 }} />
                <button onClick={() => { if (delText === 'DELETE') onDeleteAccount(); }} disabled={delText !== 'DELETE'}
                  style={{ ...s.btnDanger, opacity: delText !== 'DELETE' ? 0.4 : 1, marginTop: 0 }}>
                  Permanently delete account
                </button>
                <button onClick={() => { setDelConfirm(false); setDelText(''); }} style={s.btnSec}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
