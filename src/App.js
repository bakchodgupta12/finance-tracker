import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import {
  saveData, loadData, userExists, verifyPassword,
  hashPassword, normaliseAnswer, verifySecurityAnswer,
  getSecurityQuestion, fetchFxRates
} from './supabase';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const ALL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TABS = ['overview','income','expenses','allocation','actuals','net worth'];
const CAT_COLORS = { Savings:'#7ec8a0', Investments:'#7eb5d6', Needs:'#e8a598', Wants:'#d6a8c8' };

const CURRENCIES = [
  { code:'GBP', symbol:'£',    locale:'en-GB' },
  { code:'USD', symbol:'$',    locale:'en-US' },
  { code:'EUR', symbol:'€',    locale:'de-DE' },
  { code:'INR', symbol:'₹',   locale:'en-IN' },
  { code:'AED', symbol:'AED ', locale:'ar-AE' },
  { code:'SGD', symbol:'S$',   locale:'en-SG' },
  { code:'HKD', symbol:'HK$',  locale:'en-HK' },
  { code:'THB', symbol:'฿',    locale:'th-TH' },
  { code:'CAD', symbol:'CA$',  locale:'en-CA' },
  { code:'AUD', symbol:'A$',   locale:'en-AU' },
];

const ACCOUNT_TYPES = ['Bank','Savings','Investment','Crypto','Cash','Other'];

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What was the name of your primary school?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the make of your first car?",
  "What is the name of the street you grew up on?",
];

const DEFAULT_ACCOUNTS = [
  { id:1, name:'HSBC HK',       type:'Bank',       currency:'HKD', note:'' },
  { id:2, name:'HDFC India',     type:'Bank',       currency:'INR', note:'' },
  { id:3, name:'Kbank Thailand', type:'Bank',       currency:'THB', note:'' },
  { id:4, name:'Binance',        type:'Crypto',     currency:'USD', note:'' },
  { id:5, name:'Motilal Oswal',  type:'Investment', currency:'INR', note:'' },
  { id:6, name:'IBKR',           type:'Investment', currency:'USD', note:'' },
  { id:7, name:'MetaMask',       type:'Crypto',     currency:'USD', note:'' },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}
function fmt(v = 0, sym = '£', locale = 'en-GB', compact = false) {
  const n = Number(v) || 0;
  if (compact && Math.abs(n) >= 1000) return `${sym}${(n/1000).toFixed(1)}k`;
  return `${sym}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)}`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
function getMonthsFromStart(i) {
  return [...ALL_MONTHS.slice(i), ...ALL_MONTHS.slice(0, i)];
}

// ─────────────────────────────────────────────
// Default state
// ─────────────────────────────────────────────
const makeDefaultState = () => ({
  userId: '', passwordHash: '', securityQuestion: '', securityAnswerHash: '',
  displayName: '', currencyCode: 'GBP', yearStartMonth: 0,
  incomeSources: [{ id:1, label:'Salary', amount:3000 }],
  monthlyIncomeOverrides: {},
  startingBalance: 0, goalSavings: 10000,
  allocation: [
    { id:1, label:'Emergency Fund',        category:'Savings',     pct:10 },
    { id:2, label:'Investment Account',     category:'Investments', pct:10 },
    { id:3, label:'Pension / ISA',          category:'Investments', pct:5  },
    { id:4, label:'Rent / Mortgage',        category:'Needs',       pct:30 },
    { id:5, label:'Groceries',              category:'Needs',       pct:10 },
    { id:6, label:'Transport',              category:'Needs',       pct:5  },
    { id:7, label:'Subscriptions',          category:'Wants',       pct:2  },
    { id:8, label:'Dining / Entertainment', category:'Wants',       pct:5  },
  ],
  subscriptions: [
    { id:1, label:'Gym Membership',              amount:0 },
    { id:2, label:'Streaming (Netflix/Spotify)',  amount:0 },
    { id:3, label:'Cloud Storage',               amount:0 },
  ],
  monthlyBalances: ALL_MONTHS.map(m => ({ month:m, start:0, end:0, notes:'' })),
  actuals: {},
  // Accounts: user-defined list of bank/investment accounts
  accounts: DEFAULT_ACCOUNTS,
  // accountSnapshots: { "Jan": { 1: 45000, 2: 120000 } } — keyed by account id
  accountSnapshots: {},
  // Liabilities
  liabilities: [
    { id:1, label:'Mortgage Balance', amount:0 },
    { id:2, label:'Credit Card',      amount:0 },
    { id:3, label:'Student Loan',     amount:0 },
  ],
});

// ─────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────
const s = {
  card:  { background:'#fff', border:'1px solid #e8e4dc', borderRadius:14, padding:'18px 20px' },
  label: { fontSize:10, color:'#9e9890', letterSpacing:'0.12em', fontWeight:600, margin:0 },
  input: { background:'#f9f7f3', border:'1px solid #e8e4dc', borderRadius:7, color:'#2d2a26', padding:'6px 10px', fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' },
  btn:   { width:'100%', background:'#2d2a26', color:'#f7f5f0', border:'none', borderRadius:8, padding:'10px', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnSec:{ width:'100%', background:'transparent', color:'#9e9890', border:'1px solid #e8e4dc', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
  btnDanger:{ width:'100%', background:'transparent', color:'#c94040', border:'1px solid #e8a598', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
};

// ─────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────
const Inp = ({ value, onChange, type='text', style={}, placeholder='', onKeyDown, disabled }) => (
  <input type={type} value={value} placeholder={placeholder} onKeyDown={onKeyDown} disabled={disabled}
    onChange={e => onChange(type==='number' ? (parseFloat(e.target.value)||0) : e.target.value)}
    style={{ ...s.input, ...style, opacity: disabled ? 0.5 : 1 }} />
);
const Lbl = ({ children }) => <p style={{ ...s.label, marginBottom:6 }}>{children}</p>;
const DelBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 3px', flexShrink:0 }}>×</button>
);
const AddBtn = ({ onClick, label='+ Add' }) => (
  <button onClick={onClick} style={{ fontSize:11, background:'transparent', border:'1px dashed #d8d4cc', borderRadius:7, padding:'5px 12px', cursor:'pointer', color:'#a09890', marginTop:8, width:'100%' }}>{label}</button>
);
const Tag = ({ label, color }) => (
  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:color+'28', color, fontWeight:600, letterSpacing:'0.08em' }}>{label}</span>
);
const Divider = () => <div style={{ borderTop:'1px solid #f0ece4', margin:'16px 0' }} />;
const FG = ({ label, children }) => <div style={{ marginBottom:16 }}><Lbl>{label}</Lbl>{children}</div>;
const Toast = ({ msg, type='success' }) => msg ? (
  <div style={{ fontSize:12, padding:'8px 12px', borderRadius:8, marginBottom:14,
    background: type==='success' ? '#f0fdf4' : '#fdf2f2',
    color: type==='success' ? '#2d9e6b' : '#c94040',
    border:`1px solid ${type==='success' ? '#bbf7d0':'#fecaca'}` }}>
    {type==='success' ? '✓ ' : '⚠ '}{msg}
  </div>
) : null;

const TypeBadge = ({ type }) => {
  const colors = { Bank:'#7eb5d6', Savings:'#7ec8a0', Investment:'#b5a8d6', Crypto:'#f9a8d4', Cash:'#fdba74', Other:'#d5d0c9' };
  return <Tag label={type} color={colors[type] || '#d5d0c9'} />;
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)', fontSize:12 }}>
      <p style={{ color:'#9e9890', marginBottom:5, fontSize:10, letterSpacing:'0.1em' }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color||'#2d2a26', margin:'2px 0', fontWeight:600 }}>{p.name}: {p.value}</p>)}
    </div>
  );
};

// ─────────────────────────────────────────────
// Login screen
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [step, setStep]   = useState('username');
  const [u, setU]         = useState('');
  const [pw, setPw]       = useState('');
  const [pw2, setPw2]     = useState('');
  const [secQ, setSecQ]   = useState(SECURITY_QUESTIONS[0]);
  const [secA, setSecA]   = useState('');
  const [fQ, setFQ]       = useState('');
  const [fA, setFA]       = useState('');
  const [nPw, setNPw]     = useState('');
  const [nPw2, setNPw2]   = useState('');
  const [err, setErr]     = useState('');
  const [busy, setBusy]   = useState(false);

  const go = fn => async () => { setErr(''); setBusy(true); await fn(); setBusy(false); };
  const enter = fn => e => { if (e.key==='Enter') fn(); };

  const checkUser = go(async () => {
    if (!u.trim()) { setErr('Please enter a username.'); return; }
    const exists = await userExists(u.trim().toLowerCase());
    setStep(exists ? 'password' : 'set-password');
  });

  const login = go(async () => {
    if (!pw) { setErr('Please enter your password.'); return; }
    const ok = await verifyPassword(u.trim().toLowerCase(), pw);
    if (!ok) { setErr('Incorrect password. Try again.'); return; }
    const { data } = await loadData(u.trim().toLowerCase());
    onLogin(u.trim().toLowerCase(), data);
  });

  const create = go(async () => {
    if (pw.length < 4) { setErr('Password must be at least 4 characters.'); return; }
    if (pw !== pw2)    { setErr('Passwords do not match.'); return; }
    if (!secA.trim())  { setErr('Please answer the security question.'); return; }
    const pwH  = await hashPassword(pw);
    const aH   = await hashPassword(normaliseAnswer(secA));
    onLogin(u.trim().toLowerCase(), null, pwH, secQ, aH);
  });

  const loadQ = go(async () => {
    const q = await getSecurityQuestion(u.trim().toLowerCase());
    if (!q) { setErr('No security question found for this account.'); return; }
    setFQ(q); setStep('forgot-answer');
  });

  const checkAnswer = go(async () => {
    if (!fA.trim()) { setErr('Please enter your answer.'); return; }
    const { ok } = await verifySecurityAnswer(u.trim().toLowerCase(), fA);
    if (!ok) { setErr('Incorrect answer. Try again.'); return; }
    setStep('reset-pw');
  });

  const resetPw = go(async () => {
    if (nPw.length < 4)  { setErr('Password must be at least 4 characters.'); return; }
    if (nPw !== nPw2)    { setErr('Passwords do not match.'); return; }
    const { data } = await loadData(u.trim().toLowerCase());
    if (!data) { setErr('Could not load account.'); return; }
    const hash = await hashPassword(nPw);
    await saveData(u.trim().toLowerCase(), { ...data, passwordHash: hash });
    onLogin(u.trim().toLowerCase(), { ...data, passwordHash: hash });
  });

  const back = to => () => { setStep(to); setErr(''); setPw(''); setPw2(''); };

  const card = { ...s.card, maxWidth:400, width:'100%', margin:'20px' };

  return (
    <div style={{ minHeight:'100vh', background:'#f7f5f0', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={card}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <p style={{ fontFamily:'Lora, serif', fontSize:26, color:'#1a1714', marginBottom:4 }}>Finance Tracker</p>
          <p style={{ fontSize:13, color:'#9e9890' }}>
            {step==='username'      && 'Enter your username to get started.'}
            {step==='password'      && `Welcome back, ${capitalize(u)} 👋`}
            {step==='set-password'  && `Create your profile for ${capitalize(u)}`}
            {step==='forgot-start'  && 'Reset your password'}
            {step==='forgot-answer' && 'Answer your security question'}
            {step==='reset-pw'      && 'Choose a new password'}
          </p>
        </div>

        {step==='username' && <>
          <FG label="USERNAME"><Inp value={u} onChange={setU} placeholder="e.g. alex" onKeyDown={enter(checkUser)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={checkUser} disabled={busy} style={s.btn}>{busy?'Checking…':'Continue →'}</button>
          <p style={{ fontSize:11, color:'#c0bab2', marginTop:14, textAlign:'center' }}>New username = new profile. Returning = loads your data.</p>
        </>}

        {step==='password' && <>
          <FG label="PASSWORD"><Inp type="password" value={pw} onChange={setPw} placeholder="Your password" onKeyDown={enter(login)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={login} disabled={busy} style={s.btn}>{busy?'Verifying…':'Log in →'}</button>
          <button onClick={()=>{setStep('forgot-start');setErr('');}} style={s.btnSec}>Forgot password?</button>
          <button onClick={back('username')} style={s.btnSec}>← Back</button>
        </>}

        {step==='set-password' && <>
          <div style={{ fontSize:12, color:'#2d9e6b', background:'#f0fdf4', borderRadius:8, padding:'8px 12px', marginBottom:16 }}>✓ Username available — set up your profile.</div>
          <FG label="CREATE PASSWORD"><Inp type="password" value={pw} onChange={setPw} placeholder="At least 4 characters" /></FG>
          <FG label="CONFIRM PASSWORD"><Inp type="password" value={pw2} onChange={setPw2} placeholder="Repeat password" /></FG>
          <FG label="SECURITY QUESTION">
            <select value={secQ} onChange={e=>setSecQ(e.target.value)} style={s.input}>
              {SECURITY_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
          </FG>
          <FG label="YOUR ANSWER"><Inp value={secA} onChange={setSecA} placeholder="Answer (not case-sensitive)" onKeyDown={enter(create)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={create} disabled={busy} style={s.btn}>{busy?'Creating…':'Create profile →'}</button>
          <button onClick={back('username')} style={s.btnSec}>← Back</button>
        </>}

        {step==='forgot-start' && <>
          <FG label="YOUR USERNAME"><Inp value={u} onChange={setU} placeholder="Enter your username" onKeyDown={enter(loadQ)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={loadQ} disabled={busy} style={s.btn}>{busy?'Looking up…':'Continue →'}</button>
          <button onClick={back('password')} style={s.btnSec}>← Back to login</button>
        </>}

        {step==='forgot-answer' && <>
          <div style={{ fontSize:13, color:'#4a4643', background:'#f9f7f3', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>{fQ}</div>
          <FG label="YOUR ANSWER"><Inp value={fA} onChange={setFA} placeholder="Answer" onKeyDown={enter(checkAnswer)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={checkAnswer} disabled={busy} style={s.btn}>{busy?'Checking…':'Verify →'}</button>
          <button onClick={back('forgot-start')} style={s.btnSec}>← Back</button>
        </>}

        {step==='reset-pw' && <>
          <div style={{ fontSize:12, color:'#2d9e6b', background:'#f0fdf4', borderRadius:8, padding:'8px 12px', marginBottom:16 }}>✓ Identity confirmed. Choose a new password.</div>
          <FG label="NEW PASSWORD"><Inp type="password" value={nPw} onChange={setNPw} placeholder="At least 4 characters" /></FG>
          <FG label="CONFIRM"><Inp type="password" value={nPw2} onChange={setNPw2} placeholder="Repeat" onKeyDown={enter(resetPw)} /></FG>
          <Toast msg={err} type="error" />
          <button onClick={resetPw} disabled={busy} style={s.btn}>{busy?'Saving…':'Set new password →'}</button>
        </>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings panel
// ─────────────────────────────────────────────
function SettingsPanel({ state, set, onClose, onDeleteAccount, onLogout }) {
  const [section, setSection]   = useState('profile');
  const [oldPw, setOldPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [cPw, setCPw]           = useState('');
  const [pwMsg, setPwMsg]       = useState(null);
  const [busyPw, setBusyPw]     = useState(false);
  const [delText, setDelText]   = useState('');
  const [delConfirm, setDelConfirm] = useState(false);

  const currency = getCurrency(state.currencyCode || 'GBP');

  const changePw = async () => {
    setPwMsg(null);
    if (!oldPw)        { setPwMsg({ text:'Enter your current password.', type:'error' }); return; }
    if (newPw.length<4){ setPwMsg({ text:'New password must be 4+ characters.', type:'error' }); return; }
    if (newPw!==cPw)   { setPwMsg({ text:'Passwords do not match.', type:'error' }); return; }
    setBusyPw(true);
    const ok = await verifyPassword(state.userId, oldPw);
    if (!ok) { setPwMsg({ text:'Current password incorrect.', type:'error' }); setBusyPw(false); return; }
    const h = await hashPassword(newPw);
    set('passwordHash', h);
    setOldPw(''); setNewPw(''); setCPw('');
    setPwMsg({ text:'Password updated.', type:'success' });
    setBusyPw(false);
  };

  const SECS = [
    { id:'profile',  label:'Profile' },
    { id:'accounts', label:'Accounts' },
    { id:'security', label:'Security' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex' }}>
      <div onClick={onClose} style={{ flex:1, background:'rgba(0,0,0,0.18)' }} />
      <div style={{ width:460, background:'#fff', borderLeft:'1px solid #e8e4dc', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #f0ece4', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontFamily:'Lora, serif', fontSize:18, color:'#1a1714' }}>Settings</p>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9e9890' }}>×</button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid #f0ece4', padding:'0 24px' }}>
          {SECS.map(sec => (
            <button key={sec.id} onClick={()=>setSection(sec.id)} style={{
              background:'none', border:'none',
              borderBottom: section===sec.id ? '2px solid #2d2a26' : '2px solid transparent',
              color: section===sec.id ? '#1a1714' : '#a09890',
              cursor:'pointer', padding:'10px 14px 10px 0', marginRight:16,
              fontSize:12, fontWeight: section===sec.id ? 600 : 400, fontFamily:'inherit',
            }}>{sec.label}</button>
          ))}
        </div>

        <div style={{ padding:'24px', flex:1 }}>

          {/* ── Profile ── */}
          {section==='profile' && <>
            <FG label="DISPLAY NAME">
              <Inp value={state.displayName||''} onChange={v=>set('displayName',v)} placeholder={capitalize(state.userId)} />
              <p style={{ fontSize:11, color:'#b0aa9f', marginTop:4 }}>Shown in the greeting. Blank = username.</p>
            </FG>
            <FG label="HOME CURRENCY">
              <select value={state.currencyCode||'GBP'} onChange={e=>set('currencyCode',e.target.value)} style={s.input}>
                {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
              </select>
            </FG>
            <FG label="FINANCIAL YEAR STARTS">
              <select value={state.yearStartMonth??0} onChange={e=>set('yearStartMonth',Number(e.target.value))} style={s.input}>
                {ALL_MONTHS.map((m,i)=>(
                  <option key={m} value={i}>{m}{i===0?' (Calendar year)':i===3?' (UK tax year)':''}</option>
                ))}
              </select>
            </FG>
            <Divider />
            <p style={{ ...s.label, color:'#c94040', marginBottom:12 }}>DANGER ZONE</p>
            {!delConfirm ? (
              <button onClick={()=>setDelConfirm(true)} style={s.btnDanger}>Delete my account & all data</button>
            ) : (
              <div style={{ background:'#fdf2f2', borderRadius:10, padding:'16px', border:'1px solid #fecaca' }}>
                <p style={{ fontSize:13, color:'#c94040', marginBottom:8, fontWeight:600 }}>This cannot be undone.</p>
                <p style={{ fontSize:12, color:'#6b6660', marginBottom:10 }}>Type <strong>DELETE</strong> to confirm:</p>
                <Inp value={delText} onChange={setDelText} placeholder="DELETE" style={{ marginBottom:10 }} />
                <button onClick={()=>{ if(delText==='DELETE') onDeleteAccount(); }} disabled={delText!=='DELETE'}
                  style={{ ...s.btnDanger, opacity:delText!=='DELETE'?0.4:1, marginTop:0 }}>
                  Permanently delete account
                </button>
                <button onClick={()=>{setDelConfirm(false);setDelText('');}} style={s.btnSec}>Cancel</button>
              </div>
            )}
          </>}

          {/* ── Accounts ── */}
          {section==='accounts' && <>
            <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>
              Define your bank and investment accounts here. These appear in the Net Worth tab for monthly snapshot tracking.
            </p>
            {(state.accounts||[]).map(acc => (
              <div key={acc.id} style={{ background:'#f9f7f3', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid #f0ece4' }}>
                <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                  <Inp value={acc.name} onChange={v=>set('accounts',prev=>prev.map(a=>a.id===acc.id?{...a,name:v}:a))}
                    placeholder="Account name" style={{ flex:2 }} />
                  <DelBtn onClick={()=>set('accounts',prev=>prev.filter(a=>a.id!==acc.id))} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={acc.type} onChange={e=>set('accounts',prev=>prev.map(a=>a.id===acc.id?{...a,type:e.target.value}:a))}
                    style={{ ...s.input, flex:1 }}>
                    {ACCOUNT_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <select value={acc.currency} onChange={e=>set('accounts',prev=>prev.map(a=>a.id===acc.id?{...a,currency:e.target.value}:a))}
                    style={{ ...s.input, flex:1 }}>
                    {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <AddBtn onClick={()=>set('accounts',prev=>[...prev,{id:Date.now(),name:'New Account',type:'Bank',currency:'GBP',note:''}])}
              label="+ Add account" />
          </>}

          {/* ── Security ── */}
          {section==='security' && <>
            <p style={{ fontSize:13, color:'#6b6660', marginBottom:20 }}>Logged in as <strong>{state.userId}</strong></p>
            <p style={{ ...s.label, marginBottom:14 }}>CHANGE PASSWORD</p>
            <FG label="CURRENT PASSWORD"><Inp type="password" value={oldPw} onChange={setOldPw} placeholder="Current password" /></FG>
            <FG label="NEW PASSWORD"><Inp type="password" value={newPw} onChange={setNewPw} placeholder="At least 4 characters" /></FG>
            <FG label="CONFIRM NEW PASSWORD"><Inp type="password" value={cPw} onChange={setCPw} placeholder="Repeat" /></FG>
            {pwMsg && <Toast msg={pwMsg.text} type={pwMsg.type} />}
            <button onClick={changePw} disabled={busyPw} style={s.btn}>{busyPw?'Saving…':'Update password'}</button>
            <Divider />
            <p style={{ ...s.label, marginBottom:8 }}>SECURITY QUESTION</p>
            <div style={{ background:'#f9f7f3', borderRadius:8, padding:'12px 14px', fontSize:13, color:'#6b6660' }}>
              {state.securityQuestion||'No security question set.'}
            </div>
            <Divider />
            <button onClick={onLogout} style={s.btnSec}>Log out</button>
          </>}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const [state, setState]             = useState(makeDefaultState());
  const [tab, setTab]                 = useState('overview');
  const [saveStatus, setSaveStatus]   = useState('');
  const [loaded, setLoaded]           = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fxRates, setFxRates]         = useState({});   // rates FROM home currency
  const [fxLoading, setFxLoading]     = useState(false);
  const fxCacheRef                    = useRef({});

  const set = useCallback((key, val) =>
    setState(prev => ({ ...prev, [key]: typeof val==='function' ? val(prev[key]) : val }))
  , []);

  const currency = getCurrency(state.currencyCode || 'GBP');
  const f = useCallback((v, compact) => fmt(v, currency.symbol, currency.locale, compact), [currency]);

  // Fetch FX rates whenever home currency changes
  useEffect(() => {
    if (!loaded) return;
    const code = state.currencyCode || 'GBP';
    if (fxCacheRef.current[code]) { setFxRates(fxCacheRef.current[code]); return; }
    setFxLoading(true);
    fetchFxRates(code).then(rates => {
      fxCacheRef.current[code] = rates;
      setFxRates(rates);
      setFxLoading(false);
    });
  }, [state.currencyCode, loaded]);

  // Convert any amount in fromCurrency to home currency
  const toHome = useCallback((amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === (state.currencyCode||'GBP')) return amount;
    const rate = fxRates[fromCurrency];
    if (!rate) return null; // unknown rate
    return amount / rate;
  }, [fxRates, state.currencyCode]);

  const MONTHS = useMemo(() => getMonthsFromStart(state.yearStartMonth ?? 0), [state.yearStartMonth]);

  // Auto-save
  useEffect(() => {
    if (!loaded || !state.userId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const { error } = await saveData(state.userId, state);
      setSaveStatus(error ? 'error' : 'saved');
      if (!error) setTimeout(() => setSaveStatus(''), 2500);
    }, 1200);
    return () => clearTimeout(t);
  }, [state, loaded]);

  const handleLogin = useCallback((userId, existingData, pwHash, secQ, secAHash) => {
    setState(existingData
      ? { ...makeDefaultState(), ...existingData, userId }
      : { ...makeDefaultState(), userId, passwordHash:pwHash||'', securityQuestion:secQ||'', securityAnswerHash:secAHash||'' }
    );
    setLoaded(true);
  }, []);

  const handleLogout = useCallback(() => { setLoaded(false); setShowSettings(false); setState(makeDefaultState()); }, []);

  const handleDeleteAccount = useCallback(async () => {
    const mod = await import('./supabase');
    if (mod.supabase) await mod.supabase.from('tracker_data').delete().eq('user_id', state.userId);
    handleLogout();
  }, [state.userId, handleLogout]);

  // Derived
  const baseIncome     = state.incomeSources.reduce((s,i) => s+i.amount, 0);
  const monthIncome    = useCallback(m => state.monthlyIncomeOverrides[m] ?? baseIncome, [state.monthlyIncomeOverrides, baseIncome]);
  const allocByCat     = useMemo(() => {
    const map = {};
    for (const cat of ['Savings','Investments','Needs','Wants'])
      map[cat] = state.allocation.filter(a=>a.category===cat).reduce((s,a)=>s+a.pct,0);
    return map;
  }, [state.allocation]);
  const totalAllocPct  = Object.values(allocByCat).reduce((s,v)=>s+v,0);

  const projData = useMemo(() => {
    let bal = state.startingBalance;
    return MONTHS.map(month => {
      const inc = monthIncome(month);
      bal += inc - inc*(totalAllocPct/100);
      return { month, income:Math.round(inc), balance:Math.round(bal) };
    });
  }, [state.startingBalance, monthIncome, totalAllocPct, MONTHS]);

  const yearEndBal    = projData[11]?.balance ?? 0;
  const totalSaved    = MONTHS.reduce((s,m)=>s+(allocByCat.Savings/100)*monthIncome(m),0);
  const totalInvested = MONTHS.reduce((s,m)=>s+(allocByCat.Investments/100)*monthIncome(m),0);

  // Net worth from account snapshots (latest month with data) + any extra assets not in accounts
  const latestSnapshots = useMemo(() => {
    // Find the most recent month that has any snapshot data
    for (let i = MONTHS.length-1; i >= 0; i--) {
      const snap = state.accountSnapshots?.[MONTHS[i]];
      if (snap && Object.values(snap).some(v => v > 0)) return snap;
    }
    return null;
  }, [state.accountSnapshots, MONTHS]);

  const accountsNetWorth = useMemo(() => {
    if (!latestSnapshots) return 0;
    return (state.accounts||[]).reduce((sum, acc) => {
      const bal = latestSnapshots[acc.id] || 0;
      const inHome = toHome(bal, acc.currency);
      return sum + (inHome ?? 0);
    }, 0);
  }, [latestSnapshots, state.accounts, toHome]);

  const totalLiabilities = state.liabilities.reduce((s,l)=>s+l.amount,0);
  const netWorth = accountsNetWorth - totalLiabilities;

  const getActual  = (month, key) => state.actuals[month]?.[key] ?? '';
  const setActual  = (month, key, val) => set('actuals', prev => ({ ...prev, [month]:{ ...(prev[month]||{}), [key]:val } }));

  const getSnap  = (month, accId) => state.accountSnapshots?.[month]?.[accId] ?? '';
  const setSnap  = (month, accId, val) => set('accountSnapshots', prev => ({
    ...prev, [month]: { ...(prev[month]||{}), [accId]: val }
  }));

  const displayName = (state.displayName?.trim()) || capitalize(state.userId);

  if (!loaded) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ minHeight:'100vh', background:'#f7f5f0', fontFamily:"'DM Sans', sans-serif", color:'#2d2a26' }}>

      {showSettings && (
        <SettingsPanel state={state} set={set}
          onClose={()=>setShowSettings(false)}
          onDeleteAccount={handleDeleteAccount}
          onLogout={handleLogout} />
      )}

      {/* Top bar */}
      <div style={{ borderBottom:'1px solid #e8e4dc', background:'#fff', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, position:'sticky', top:0, zIndex:10 }}>
        <p style={{ fontFamily:'Lora, serif', fontSize:18, fontWeight:500, color:'#1a1714' }}>Finance Tracker</p>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:11, color: saveStatus==='error'?'#c94040':'#b0aa9f' }}>
            {saveStatus==='saving'&&'⟳ Saving…'}
            {saveStatus==='saved' &&'✓ Saved'}
            {saveStatus==='error' &&'⚠ Save failed'}
          </span>
          <button onClick={()=>setShowSettings(true)} title="Settings"
            style={{ background:'none', border:'1px solid #e8e4dc', borderRadius:8, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom:'1px solid #e8e4dc', background:'#fff', padding:'0 24px', display:'flex' }}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            background:'none', border:'none',
            borderBottom: tab===t ? '2px solid #2d2a26' : '2px solid transparent',
            color: tab===t ? '#1a1714' : '#a09890', cursor:'pointer', padding:'12px 16px',
            fontSize:12, fontWeight: tab===t?600:400, textTransform:'capitalize',
            fontFamily:'inherit', letterSpacing:'0.02em', transition:'color 0.15s',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px' }}>

        {/* ══════════ OVERVIEW ══════════ */}
        {tab==='overview' && (
          <div>
            <div style={{ marginBottom:24 }}>
              <p style={{ fontFamily:'Lora, serif', fontSize:26, fontWeight:400, color:'#1a1714', marginBottom:2 }}>
                {getGreeting()}, {displayName} 👋
              </p>
              <p style={{ fontSize:13, color:'#9e9890' }}>Here's your financial overview for {new Date().getFullYear()}.</p>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
              {[
                { label:'Net Worth',           value:f(netWorth,true),      sub:'assets − liabilities',                                              dot:'#7eb5d6' },
                { label:'Projected Saved',     value:f(totalSaved,true),    sub:`${allocByCat.Savings}% of income`,                                  dot:'#7ec8a0' },
                { label:'Projected Invested',  value:f(totalInvested,true), sub:`${allocByCat.Investments}% of income`,                              dot:'#b5a8d6' },
                { label:'Year-End Balance',    value:f(yearEndBal,true),    sub:yearEndBal>=state.goalSavings?'✓ On track':`Goal: ${f(state.goalSavings,true)}`, dot:yearEndBal>=state.goalSavings?'#7ec8a0':'#e8a598' },
              ].map((k,i)=>(
                <div key={i} style={{ ...s.card, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:k.dot, opacity:0.7 }} />
                  <div style={{ marginTop:4, marginBottom:6 }}><span style={s.label}>{k.label.toUpperCase()}</span></div>
                  <p style={{ fontSize:19, fontWeight:600, color:'#1a1714', marginBottom:2 }}>{k.value}</p>
                  <p style={{ fontSize:11, color:'#b0aa9f' }}>{k.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
              <div style={s.card}><Lbl>STARTING BALANCE</Lbl><Inp type="number" value={state.startingBalance} onChange={v=>set('startingBalance',v)} /></div>
              <div style={s.card}><Lbl>ANNUAL SAVINGS GOAL</Lbl><Inp type="number" value={state.goalSavings} onChange={v=>set('goalSavings',v)} /></div>
              <div style={s.card}><Lbl>BASE MONTHLY INCOME</Lbl><div style={{ ...s.input, color:'#9e9890' }}>{f(baseIncome)}</div><p style={{ fontSize:11, color:'#c0bab2', marginTop:4 }}>Set in Income tab</p></div>
            </div>

            <div style={{ ...s.card, marginBottom:16 }}>
              <p style={{ ...s.label, marginBottom:16 }}>PROJECTED BALANCE TRAJECTORY</p>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={projData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7eb5d6" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#7eb5d6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4"/>
                  <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill:'#b0aa9f', fontSize:11 }}/>
                  <YAxis stroke="#e8e4dc" tick={{ fill:'#b0aa9f', fontSize:11 }} tickFormatter={v=>`${currency.symbol}${(v/1000).toFixed(0)}k`}/>
                  <Tooltip content={<ChartTip />}/>
                  <Area type="monotone" dataKey="balance" name="Balance" stroke="#7eb5d6" fill="url(#g1)" strokeWidth={2} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={s.card}>
              <p style={{ ...s.label, marginBottom:4 }}>MONTH-BY-MONTH DETAIL</p>
              <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>Override income for bonus months. Log start & end balance to catch untracked spending.</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr>{['Month','Income (override)','Start Balance','End Balance','Difference','Notes'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', color:'#b0aa9f', fontSize:10, letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid #f0ece4', fontWeight:500 }}>{h.toUpperCase()}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {MONTHS.map(month=>{
                      const override = state.monthlyIncomeOverrides[month];
                      const ri = ALL_MONTHS.indexOf(month);
                      const rb = state.monthlyBalances[ri]||{start:0,end:0,notes:''};
                      const hasBal = rb.start>0||rb.end>0;
                      const diff = hasBal ? rb.end-rb.start : null;
                      return (
                        <tr key={month} style={{ borderBottom:'1px solid #f9f7f3' }}>
                          <td style={{ padding:'6px 10px', color:'#6b6660', fontWeight:500 }}>{month}</td>
                          <td style={{ padding:'4px 10px' }}>
                            <Inp type="number" value={override??''} placeholder={f(baseIncome)}
                              onChange={v=>set('monthlyIncomeOverrides',prev=>{const n={...prev};if(!v)delete n[month];else n[month]=v;return n;})}
                              style={{ width:110 }}/>
                          </td>
                          <td style={{ padding:'4px 10px' }}><Inp type="number" value={rb.start||''} style={{ width:90 }} onChange={v=>set('monthlyBalances',prev=>prev.map((r,j)=>j===ri?{...r,start:v}:r))}/></td>
                          <td style={{ padding:'4px 10px' }}><Inp type="number" value={rb.end||''} style={{ width:90 }} onChange={v=>set('monthlyBalances',prev=>prev.map((r,j)=>j===ri?{...r,end:v}:r))}/></td>
                          <td style={{ padding:'6px 10px', fontWeight:600, color:diff===null?'#d5d0c8':diff>=0?'#2d9e6b':'#c94040' }}>
                            {diff===null?'—':(diff>=0?'+':'')+f(diff,true)}
                          </td>
                          <td style={{ padding:'4px 10px' }}><Inp value={rb.notes} style={{ width:140 }} onChange={v=>set('monthlyBalances',prev=>prev.map((r,j)=>j===ri?{...r,notes:v}:r))}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ INCOME ══════════ */}
        {tab==='income' && (
          <div style={{ maxWidth:560 }}>
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom:4 }}>MONTHLY INCOME SOURCES</p>
              <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>Base income. Override any month in Overview for bonuses or side income.</p>
              {state.incomeSources.map(src=>(
                <div key={src.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                  <Inp value={src.label} onChange={v=>set('incomeSources',prev=>prev.map(x=>x.id===src.id?{...x,label:v}:x))} style={{ flex:2 }}/>
                  <span style={{ color:'#b0aa9f', fontSize:13 }}>{currency.symbol}</span>
                  <Inp type="number" value={src.amount} onChange={v=>set('incomeSources',prev=>prev.map(x=>x.id===src.id?{...x,amount:v}:x))} style={{ flex:1, textAlign:'right' }}/>
                  <DelBtn onClick={()=>set('incomeSources',prev=>prev.filter(x=>x.id!==src.id))}/>
                </div>
              ))}
              <AddBtn onClick={()=>set('incomeSources',prev=>[...prev,{id:Date.now(),label:'New Source',amount:0}])}/>
              <Divider />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, color:'#6b6660' }}>Total base monthly income</span>
                <span style={{ fontSize:17, fontWeight:600 }}>{f(baseIncome)}</span>
              </div>
            </div>
            <div style={{ ...s.card, marginTop:14 }}>
              <p style={{ ...s.label, marginBottom:16 }}>WHERE IT GOES</p>
              {['Savings','Investments','Needs','Wants'].map(cat=>(
                <div key={cat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:CAT_COLORS[cat], flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:13 }}>{cat}</span>
                  <span style={{ fontSize:12, color:'#b0aa9f' }}>{(allocByCat[cat]||0).toFixed(1)}%</span>
                  <span style={{ fontWeight:600, fontSize:13, minWidth:80, textAlign:'right' }}>{f((allocByCat[cat]||0)/100*baseIncome)}</span>
                </div>
              ))}
              <Divider />
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:'#9e9890' }}>Unallocated</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#9e9890' }}>{f(((100-totalAllocPct)/100)*baseIncome,true)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ EXPENSES ══════════ */}
        {tab==='expenses' && (
          <div style={{ maxWidth:560 }}>
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom:4 }}>SUBSCRIPTIONS</p>
              <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>Fixed recurring costs each month.</p>
              {state.subscriptions.map(sub=>(
                <div key={sub.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                  <Inp value={sub.label} onChange={v=>set('subscriptions',prev=>prev.map(x=>x.id===sub.id?{...x,label:v}:x))} style={{ flex:2 }}/>
                  <span style={{ color:'#b0aa9f', fontSize:13 }}>{currency.symbol}</span>
                  <Inp type="number" value={sub.amount} onChange={v=>set('subscriptions',prev=>prev.map(x=>x.id===sub.id?{...x,amount:v}:x))} style={{ flex:1, textAlign:'right' }}/>
                  <DelBtn onClick={()=>set('subscriptions',prev=>prev.filter(x=>x.id!==sub.id))}/>
                </div>
              ))}
              <AddBtn onClick={()=>set('subscriptions',prev=>[...prev,{id:Date.now(),label:'New Subscription',amount:0}])}/>
              <Divider />
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, color:'#6b6660' }}>Total / month</span>
                <span style={{ fontSize:15, fontWeight:600 }}>{f(state.subscriptions.reduce((s,x)=>s+x.amount,0))}</span>
              </div>
            </div>
            <div style={{ ...s.card, marginTop:14 }}>
              <p style={{ ...s.label, marginBottom:16 }}>EXPENSE CATEGORIES</p>
              {['Needs','Wants'].map(cat=>{
                const items = state.allocation.filter(a=>a.category===cat);
                const total = items.reduce((sum,a)=>sum+(a.pct/100)*baseIncome,0);
                return (
                  <div key={cat} style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <Tag label={cat} color={CAT_COLORS[cat]}/>
                      <span style={{ fontSize:12, color:'#9e9890' }}>{f(total,true)} / mo</span>
                    </div>
                    {items.map(item=>(
                      <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #f9f7f3', fontSize:13 }}>
                        <span style={{ color:'#6b6660' }}>{item.label}</span>
                        <span style={{ fontWeight:500 }}>{f((item.pct/100)*baseIncome,true)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════ ALLOCATION ══════════ */}
        {tab==='allocation' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
              <div style={{ ...s.card, display:'flex', alignItems:'center', gap:20 }}>
                <PieChart width={160} height={160}>
                  <Pie data={[
                    ...['Savings','Investments','Needs','Wants'].map(cat=>({ name:cat, value:allocByCat[cat]||0, fill:CAT_COLORS[cat] })),
                    { name:'Unallocated', value:Math.max(0,100-totalAllocPct), fill:'#ede9e1' },
                  ]} cx={75} cy={75} innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
                    {[0,1,2,3,4].map(i=><Cell key={i}/>)}
                  </Pie>
                </PieChart>
                <div>
                  {['Savings','Investments','Needs','Wants'].map(cat=>(
                    <div key={cat} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
                      <div style={{ width:9, height:9, borderRadius:2, background:CAT_COLORS[cat] }}/>
                      <span style={{ fontSize:12, color:'#6b6660', width:88 }}>{cat}</span>
                      <span style={{ fontSize:12, fontWeight:600 }}>{(allocByCat[cat]||0).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={s.card}>
                <p style={{ ...s.label, marginBottom:14 }}>50/30/20 BENCHMARK</p>
                {[
                  { cat:'Needs', bench:50, yours:allocByCat['Needs']||0, lowerIsBetter:true },
                  { cat:'Wants', bench:30, yours:allocByCat['Wants']||0, lowerIsBetter:true },
                  { cat:'Savings + Invest', bench:20, yours:(allocByCat['Savings']||0)+(allocByCat['Investments']||0), lowerIsBetter:false },
                ].map(({ cat, bench, yours, lowerIsBetter })=>{
                  const ok = lowerIsBetter ? yours<=bench : yours>=bench;
                  return (
                    <div key={cat} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'#6b6660' }}>{cat}</span>
                        <span style={{ color:ok?'#2d9e6b':'#c94040', fontWeight:600 }}>{yours.toFixed(0)}% <span style={{ color:'#b0aa9f', fontWeight:400 }}>/ {bench}%</span></span>
                      </div>
                      <div style={{ height:4, background:'#f0ece4', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min((yours/bench)*100,100)}%`, background:ok?'#7ec8a0':'#e8a598', borderRadius:4, transition:'width 0.4s' }}/>
                      </div>
                    </div>
                  );
                })}
                {totalAllocPct>100 && <p style={{ fontSize:11, color:'#c94040', marginTop:10, background:'#fdf2f2', padding:'6px 10px', borderRadius:7 }}>⚠ Total: {totalAllocPct.toFixed(1)}% — over 100%</p>}
              </div>
            </div>
            <div style={s.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <p style={s.label}>ALLOCATION RULES</p>
                <button onClick={()=>set('allocation',prev=>[...prev,{id:Date.now(),label:'New Item',category:'Wants',pct:0}])}
                  style={{ fontSize:11, background:'transparent', border:'1px dashed #d8d4cc', borderRadius:7, padding:'4px 12px', cursor:'pointer', color:'#a09890' }}>+ Add row</button>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr>{['Label','Category','% of Income','Monthly Amount',''].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', color:'#b0aa9f', fontSize:10, letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid #f0ece4', fontWeight:500 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {state.allocation.map(row=>(
                    <tr key={row.id} style={{ borderBottom:'1px solid #f9f7f3' }}>
                      <td style={{ padding:'5px 10px' }}><Inp value={row.label} onChange={v=>set('allocation',prev=>prev.map(x=>x.id===row.id?{...x,label:v}:x))} style={{ width:160 }}/></td>
                      <td style={{ padding:'5px 10px' }}>
                        <select value={row.category} onChange={e=>set('allocation',prev=>prev.map(x=>x.id===row.id?{...x,category:e.target.value}:x))} style={{ ...s.input, width:'auto' }}>
                          {['Savings','Investments','Needs','Wants'].map(c=><option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'5px 10px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <Inp type="number" value={row.pct} onChange={v=>set('allocation',prev=>prev.map(x=>x.id===row.id?{...x,pct:v}:x))} style={{ width:65, textAlign:'right' }}/>
                          <span style={{ color:'#b0aa9f' }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding:'5px 10px', fontWeight:500, color:'#4a4643' }}>{f((row.pct/100)*baseIncome,true)}</td>
                      <td style={{ padding:'5px 10px' }}><DelBtn onClick={()=>set('allocation',prev=>prev.filter(x=>x.id!==row.id))}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Divider />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'#9e9890' }}>Total allocated</span>
                <span style={{ fontWeight:700, color:totalAllocPct>100?'#c94040':'#1a1714' }}>{totalAllocPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ACTUALS ══════════ */}
        {tab==='actuals' && (
          <div>
            <div style={{ ...s.card, marginBottom:14 }}>
              <p style={{ ...s.label, marginBottom:4 }}>PLANNED vs ACTUAL</p>
              <p style={{ fontSize:12, color:'#b0aa9f' }}>Track both category spending discipline and whether money landed in the right accounts.</p>
            </div>

            {MONTHS.map(month=>{
              const inc = monthIncome(month);
              const planned = {
                income:inc,
                Savings:(allocByCat.Savings/100)*inc,
                Investments:(allocByCat.Investments/100)*inc,
                Needs:(allocByCat.Needs/100)*inc,
                Wants:(allocByCat.Wants/100)*inc,
              };
              const hasActuals = state.actuals[month] && Object.values(state.actuals[month]).some(v=>v>0);
              const hasSnaps   = state.accountSnapshots?.[month] && Object.values(state.accountSnapshots[month]).some(v=>v>0);

              return (
                <details key={month} style={{ ...s.card, marginBottom:10 }}>
                  <summary style={{ cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', listStyle:'none', padding:'2px 0' }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>{month}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {hasActuals && (()=>{
                        const actSpend = ['Needs','Wants'].reduce((s,k)=>s+(Number(getActual(month,k))||0),0);
                        const ok = actSpend<=(planned.Needs+planned.Wants)*1.05;
                        return <span style={{ fontSize:11, color:ok?'#2d9e6b':'#c94040', fontWeight:600 }}>{ok?'✓ On track':'⚠ Over budget'}</span>;
                      })()}
                      <span style={{ fontSize:11, color:'#b0aa9f' }}>{hasActuals||hasSnaps ? 'Logged' : 'Click to expand'}</span>
                    </div>
                  </summary>

                  <div style={{ marginTop:16 }}>
                    {/* Category layer */}
                    <p style={{ ...s.label, marginBottom:10 }}>CATEGORY BREAKDOWN</p>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:20 }}>
                      <thead>
                        <tr>{['Category','Planned','Actual','Difference'].map(h=>(
                          <th key={h} style={{ padding:'6px 10px', color:'#b0aa9f', fontSize:10, letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid #f0ece4', fontWeight:500 }}>{h.toUpperCase()}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {['income','Savings','Investments','Needs','Wants'].map(key=>{
                          const plan   = planned[key]||0;
                          const actual = getActual(month,key);
                          const diff   = actual!=='' ? Number(actual)-plan : null;
                          const isGood = diff===null?null:(key==='income'||key==='Savings'||key==='Investments')?diff>=0:diff<=0;
                          return (
                            <tr key={key} style={{ borderBottom:'1px solid #f9f7f3' }}>
                              <td style={{ padding:'6px 10px', fontWeight:500, color:'#4a4643', textTransform:'capitalize' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  {key!=='income' && <div style={{ width:7, height:7, borderRadius:'50%', background:CAT_COLORS[key] }}/>}
                                  {key}
                                </div>
                              </td>
                              <td style={{ padding:'6px 10px', color:'#9e9890' }}>{f(plan,true)}</td>
                              <td style={{ padding:'4px 10px' }}><Inp type="number" value={actual} placeholder={f(plan,true)} onChange={v=>setActual(month,key,v)} style={{ width:100 }}/></td>
                              <td style={{ padding:'6px 10px', fontWeight:600, color:diff===null?'#d5d0c8':isGood?'#2d9e6b':'#c94040' }}>
                                {diff===null?'—':(diff>=0?'+':'')+f(diff,true)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Account layer */}
                    <p style={{ ...s.label, marginBottom:4 }}>ACCOUNT SNAPSHOTS</p>
                    <p style={{ fontSize:11, color:'#b0aa9f', marginBottom:10 }}>Log end-of-month balance for each account. Auto-converts to {state.currencyCode||'GBP'}.</p>
                    {fxLoading && <p style={{ fontSize:11, color:'#b0aa9f', marginBottom:8 }}>⟳ Loading FX rates…</p>}
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr>{['Account','Type','Balance (local)','In '+( state.currencyCode||'GBP')].map(h=>(
                          <th key={h} style={{ padding:'6px 10px', color:'#b0aa9f', fontSize:10, letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid #f0ece4', fontWeight:500 }}>{h.toUpperCase()}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {(state.accounts||[]).map(acc=>{
                          const localVal  = getSnap(month, acc.id);
                          const accCur    = getCurrency(acc.currency);
                          const homeVal   = localVal!=='' ? toHome(Number(localVal), acc.currency) : null;
                          return (
                            <tr key={acc.id} style={{ borderBottom:'1px solid #f9f7f3' }}>
                              <td style={{ padding:'6px 10px', fontWeight:500, color:'#1a1714' }}>{acc.name}</td>
                              <td style={{ padding:'6px 10px' }}><TypeBadge type={acc.type}/></td>
                              <td style={{ padding:'4px 10px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                  <span style={{ fontSize:12, color:'#b0aa9f' }}>{accCur.symbol}</span>
                                  <Inp type="number" value={localVal} placeholder="0" onChange={v=>setSnap(month,acc.id,v)} style={{ width:110 }}/>
                                </div>
                              </td>
                              <td style={{ padding:'6px 10px', color: homeVal===null?'#d5d0c8':'#2d2a26', fontWeight:500 }}>
                                {homeVal===null ? (localVal!==''?'Rate unavailable':'—') : f(homeVal,true)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* ══════════ NET WORTH ══════════ */}
        {tab==='net worth' && (
          <div>
            {/* Headline */}
            <div style={{ ...s.card, marginBottom:16, textAlign:'center', padding:'28px 24px' }}>
              <p style={{ ...s.label, marginBottom:8 }}>TOTAL NET WORTH</p>
              <p style={{ fontFamily:'Lora, serif', fontSize:42, fontWeight:500, color:netWorth>=0?'#1a1714':'#c94040', margin:'0 0 4px' }}>{f(netWorth)}</p>
              <p style={{ fontSize:13, color:'#b0aa9f' }}>
                {f(accountsNetWorth)} in accounts — {f(totalLiabilities)} liabilities
                {fxLoading && <span style={{ color:'#b0aa9f' }}> · loading FX rates…</span>}
              </p>
            </div>

            {/* Account balances — latest snapshot */}
            <div style={{ ...s.card, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <p style={s.label}>ACCOUNT BALANCES</p>
                <span style={{ fontSize:11, color:'#b0aa9f' }}>Latest snapshot · add monthly data in Actuals tab</span>
              </div>
              <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>
                Showing most recent month with data. Edit accounts in ⚙️ Settings → Accounts.
              </p>

              {(state.accounts||[]).length === 0 ? (
                <p style={{ fontSize:13, color:'#b0aa9f' }}>No accounts set up yet. Add them in Settings → Accounts.</p>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr>{['Account','Type','Currency','Balance','In '+(state.currencyCode||'GBP')].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', color:'#b0aa9f', fontSize:10, letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid #f0ece4', fontWeight:500 }}>{h.toUpperCase()}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {(state.accounts||[]).map(acc=>{
                      const localVal = latestSnapshots?.[acc.id] || 0;
                      const accCur   = getCurrency(acc.currency);
                      const homeVal  = toHome(localVal, acc.currency);
                      return (
                        <tr key={acc.id} style={{ borderBottom:'1px solid #f9f7f3' }}>
                          <td style={{ padding:'8px 10px', fontWeight:600, color:'#1a1714' }}>{acc.name}</td>
                          <td style={{ padding:'8px 10px' }}><TypeBadge type={acc.type}/></td>
                          <td style={{ padding:'8px 10px', color:'#9e9890', fontSize:12 }}>{acc.currency}</td>
                          <td style={{ padding:'8px 10px', fontWeight:500 }}>{localVal>0 ? `${accCur.symbol}${new Intl.NumberFormat(accCur.locale,{maximumFractionDigits:0}).format(localVal)}` : <span style={{ color:'#d5d0c8' }}>—</span>}</td>
                          <td style={{ padding:'8px 10px', color:localVal>0?'#2d2a26':'#d5d0c8', fontWeight:localVal>0?600:400 }}>
                            {localVal>0 ? (homeVal!==null ? f(homeVal,true) : 'Rate unavailable') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Net worth over time chart */}
            {(() => {
              const chartData = MONTHS.map(month => {
                const snap = state.accountSnapshots?.[month];
                if (!snap || !Object.values(snap).some(v=>v>0)) return { month, total:null };
                const total = (state.accounts||[]).reduce((sum,acc)=>{
                  const v = snap[acc.id]||0;
                  const h = toHome(v, acc.currency);
                  return sum + (h??0);
                },0);
                return { month, total:Math.round(total-totalLiabilities) };
              }).filter(d=>d.total!==null);

              if (chartData.length < 2) return (
                <div style={{ ...s.card, marginBottom:16, textAlign:'center', padding:'24px', color:'#b0aa9f', fontSize:13 }}>
                  Log balances in at least 2 months in the Actuals tab to see your net worth trend here.
                </div>
              );

              return (
                <div style={{ ...s.card, marginBottom:16 }}>
                  <p style={{ ...s.label, marginBottom:16 }}>NET WORTH TREND</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7ec8a0" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#7ec8a0" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4"/>
                      <XAxis dataKey="month" stroke="#e8e4dc" tick={{ fill:'#b0aa9f', fontSize:11 }}/>
                      <YAxis stroke="#e8e4dc" tick={{ fill:'#b0aa9f', fontSize:11 }} tickFormatter={v=>`${currency.symbol}${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<ChartTip />}/>
                      <Area type="monotone" dataKey="total" name="Net Worth" stroke="#7ec8a0" fill="url(#nwGrad)" strokeWidth={2} dot={{ fill:'#7ec8a0', r:3 }}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {/* Liabilities */}
            <div style={s.card}>
              <p style={{ ...s.label, marginBottom:4 }}>LIABILITIES</p>
              <p style={{ fontSize:12, color:'#b0aa9f', marginBottom:16 }}>Money you owe.</p>
              {state.liabilities.map(l=>(
                <div key={l.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                  <Inp value={l.label} onChange={v=>set('liabilities',prev=>prev.map(x=>x.id===l.id?{...x,label:v}:x))} style={{ flex:2 }}/>
                  <span style={{ color:'#b0aa9f', fontSize:13 }}>{currency.symbol}</span>
                  <Inp type="number" value={l.amount} onChange={v=>set('liabilities',prev=>prev.map(x=>x.id===l.id?{...x,amount:v}:x))} style={{ flex:1, textAlign:'right' }}/>
                  <DelBtn onClick={()=>set('liabilities',prev=>prev.filter(x=>x.id!==l.id))}/>
                </div>
              ))}
              <AddBtn onClick={()=>set('liabilities',prev=>[...prev,{id:Date.now(),label:'New Liability',amount:0}])}/>
              <Divider />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:600, fontSize:13 }}>
                <span>Total liabilities</span>
                <span style={{ color:'#c94040' }}>{f(totalLiabilities)}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
