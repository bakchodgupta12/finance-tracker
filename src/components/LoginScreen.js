import { useState } from 'react';
import {
  userExists, verifyPassword, loadLatestData,
  hashPassword, normaliseAnswer, verifySecurityAnswer,
  getSecurityQuestion, saveData
} from '../supabase';
import { s, Inp, FG, Toast, Select, capitalize, SECURITY_QUESTIONS } from '../shared';

export default function LoginScreen({ onLogin }) {
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
    const { data, year } = await loadLatestData(u.trim().toLowerCase());
    onLogin(u.trim().toLowerCase(), data, year);
  });

  const create = go(async () => {
    if (pw.length < 4) { setErr('Password must be at least 4 characters.'); return; }
    if (pw !== pw2)    { setErr('Passwords do not match.'); return; }
    if (!secA.trim())  { setErr('Please answer the security question.'); return; }
    const pwH  = await hashPassword(pw);
    const aH   = await hashPassword(normaliseAnswer(secA));
    onLogin(u.trim().toLowerCase(), null, null, pwH, secQ, aH);
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
    const { data, year } = await loadLatestData(u.trim().toLowerCase());
    if (!data) { setErr('Could not load account.'); return; }
    const hash = await hashPassword(nPw);
    const updated = { ...data, passwordHash: hash };
    await saveData(u.trim().toLowerCase(), year, updated);
    onLogin(u.trim().toLowerCase(), updated, year);
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
          <p style={{ fontSize:11, color:'#c0bab2', marginTop:14, textAlign:'center' }}>Your personal finance profile. Private and password protected.</p>
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
            <Select value={secQ} onChange={e=>setSecQ(e.target.value)}>
              {SECURITY_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
            </Select>
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
