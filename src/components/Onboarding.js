import { useState } from 'react';
import { s, Inp, Select, CURRENCIES, ACCOUNT_TYPES } from '../shared';

export default function Onboarding({ onComplete }) {
  const [step, setStep]           = useState(1);
  const [currency, setCurrency]   = useState('GBP');
  const [modules, setModules]     = useState({ income: true, expenses: true, trades: true });
  const [accName, setAccName]     = useState('');
  const [accType, setAccType]     = useState('Bank');
  const [accCurrency, setAccCurrency] = useState('GBP');

  const toggle = key => setModules(prev => ({ ...prev, [key]: !prev[key] }));

  const finish = (skipAccount = false) => {
    const account = (!skipAccount && accName.trim())
      ? { id: Date.now(), name: accName.trim(), type: accType, currency: accCurrency, note: '' }
      : null;
    onComplete({ currency, modules, account });
  };

  const MODS = [
    { key: 'income',   title: 'Income Tracker',  desc: 'Log and categorise your monthly income' },
    { key: 'expenses', title: 'Expense Tracker',  desc: 'Track every transaction with categories' },
    { key: 'trades',   title: 'Trades Tracker',   desc: 'Monitor your investments and trades' },
  ];

  const dots = (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 28 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: n === step ? '#2d2a26' : '#e8e4dc',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );

  const wrap = {
    minHeight: '100vh', background: '#f7f5f0',
    fontFamily: "'DM Sans', sans-serif", color: '#2d2a26',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const card = {
    maxWidth: 480, width: '100%', margin: 20, padding: '36px 32px',
    background: '#fff', borderRadius: 18, border: '1px solid #e8e4dc',
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 13, color: '#b0aa9f', marginBottom: 6, letterSpacing: '0.06em' }}>
          Finance Tracker
        </p>

        {/* ── Step 1: Currency ── */}
        {step === 1 && (
          <>
            <p style={{ fontFamily: 'Lora, serif', fontSize: 26, color: '#1a1714', marginBottom: 6 }}>
              Welcome. Let's get you set up.
            </p>
            <p style={{ fontSize: 13, color: '#9e9890', marginBottom: 30 }}>
              This takes about 30 seconds.
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#4a4643', marginBottom: 8 }}>
              What's your home currency?
            </p>
            <Select
              value={currency}
              onChange={e => { setCurrency(e.target.value); setAccCurrency(e.target.value); }}
              style={{ fontSize: 15, padding: '10px 14px', marginBottom: 28 }}
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
            </Select>
            <button onClick={() => setStep(2)} style={s.btn}>Continue →</button>
            {dots}
          </>
        )}

        {/* ── Step 2: Modules ── */}
        {step === 2 && (
          <>
            <p style={{ fontFamily: 'Lora, serif', fontSize: 26, color: '#1a1714', marginBottom: 6 }}>
              What would you like to track?
            </p>
            <p style={{ fontSize: 13, color: '#9e9890', marginBottom: 24 }}>
              You can always change this later in Settings.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {MODS.map(m => (
                <div
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${modules[m.key] ? '#2d2a26' : '#e8e4dc'}`,
                    background: modules[m.key] ? '#f7f5f0' : '#fff',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${modules[m.key] ? '#2d2a26' : '#d8d4cc'}`,
                    background: modules[m.key] ? '#2d2a26' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {modules[m.key] && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{m.title}</p>
                    <p style={{ fontSize: 12, color: '#9e9890' }}>{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(3)} style={s.btn}>Continue →</button>
            <button onClick={() => setStep(1)} style={s.btnSec}>← Back</button>
            {dots}
          </>
        )}

        {/* ── Step 3: First account ── */}
        {step === 3 && (
          <>
            <p style={{ fontFamily: 'Lora, serif', fontSize: 26, color: '#1a1714', marginBottom: 6 }}>
              Add your first account
            </p>
            <p style={{ fontSize: 13, color: '#9e9890', marginBottom: 24 }}>
              This is where your money lives — bank accounts, investments, crypto wallets.
            </p>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>ACCOUNT NAME</p>
              <Inp value={accName} onChange={setAccName} placeholder="e.g. HSBC Savings" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>TYPE</p>
                <Select value={accType} onChange={e => setAccType(e.target.value)}>
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9e9890', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>CURRENCY</p>
                <Select value={accCurrency} onChange={e => setAccCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </div>
            </div>
            <button onClick={() => finish(false)} style={s.btn}>Finish setup →</button>
            <button onClick={() => finish(true)} style={s.btnSec}>Skip for now</button>
            <button onClick={() => setStep(2)} style={s.btnSec}>← Back</button>
            {dots}
          </>
        )}
      </div>
    </div>
  );
}
