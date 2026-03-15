import { useState } from 'react';
import { hashPassword, verifyPassword } from '../supabase';
import {
  s, Lbl, Inp, FG, Toast, Divider, DelBtn, AddBtn, TypeBadge,
  CURRENCIES, ACCOUNT_TYPES, ALL_MONTHS, capitalize
} from '../shared';

const SUB_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'security', label: 'Security' },
  { id: 'danger', label: 'Danger' },
];

export default function Settings({ state, set, onDeleteAccount, onLogout }) {
  const [subTab, setSubTab] = useState('profile');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [cPw, setCPw] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [busyPw, setBusyPw] = useState(false);
  const [delText, setDelText] = useState('');
  const [delConfirm, setDelConfirm] = useState(false);

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
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #e8e4dc' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: subTab === t.id ? '2px solid #2d2a26' : '2px solid transparent',
            color: subTab === t.id ? '#1a1714' : (t.id === 'danger' ? '#c94040' : '#a09890'),
            cursor: 'pointer', padding: '10px 16px',
            fontSize: 12, fontWeight: subTab === t.id ? 600 : 400,
            fontFamily: 'inherit', letterSpacing: '0.02em',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Profile ── */}
      {subTab === 'profile' && (
        <div style={{ maxWidth: 480 }}>
          <div style={s.card}>
            <FG label="DISPLAY NAME">
              <Inp value={state.displayName || ''} onChange={v => set('displayName', v)} placeholder={capitalize(state.userId)} />
              <p style={{ fontSize: 11, color: '#b0aa9f', marginTop: 4 }}>Shown in the greeting. Blank = username.</p>
            </FG>
            <FG label="HOME CURRENCY">
              <select value={state.currencyCode || 'GBP'} onChange={e => set('currencyCode', e.target.value)} style={s.input}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
              </select>
            </FG>
            <FG label="FINANCIAL YEAR STARTS">
              <select value={state.yearStartMonth ?? 0} onChange={e => set('yearStartMonth', Number(e.target.value))} style={s.input}>
                {ALL_MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}{i === 0 ? ' (Calendar year)' : i === 3 ? ' (UK tax year)' : ''}</option>
                ))}
              </select>
            </FG>
          </div>
        </div>
      )}

      {/* ── Accounts ── */}
      {subTab === 'accounts' && (
        <div style={{ maxWidth: 560 }}>
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
                  <select value={acc.type} onChange={e => set('accounts', prev => prev.map(a => a.id === acc.id ? { ...a, type: e.target.value } : a))}
                    style={{ ...s.input, flex: 1 }}>
                    {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={acc.currency} onChange={e => set('accounts', prev => prev.map(a => a.id === acc.id ? { ...a, currency: e.target.value } : a))}
                    style={{ ...s.input, flex: 1 }}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <AddBtn onClick={() => set('accounts', prev => [...prev, { id: Date.now(), name: 'New Account', type: 'Bank', currency: 'GBP', note: '' }])}
              label="+ Add account" />
          </div>
        </div>
      )}

      {/* ── Security ── */}
      {subTab === 'security' && (
        <div style={{ maxWidth: 480 }}>
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
        <div style={{ maxWidth: 480 }}>
          <div style={{ ...s.card, background: '#fdf2f2', borderColor: '#fecaca' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#c94040', marginBottom: 8 }}>Delete Account</p>
            <p style={{ fontSize: 13, color: '#6b6660', marginBottom: 16 }}>
              This will permanently delete your account and all associated data across all years. This action cannot be undone.
            </p>

            {!delConfirm ? (
              <button onClick={() => setDelConfirm(true)} style={s.btnDanger}>Delete my account & all data</button>
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
