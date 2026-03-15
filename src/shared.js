import React from 'react';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
export const ALL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const TABS = ['dashboard','plan','tracker','net worth','settings'];
export const CAT_COLORS = { Savings:'#7ec8a0', Investments:'#7eb5d6', Needs:'#e8a598', Wants:'#d6a8c8' };
export const CATEGORIES = ['Savings','Investments','Needs','Wants'];

export const CURRENCIES = [
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

export const ACCOUNT_TYPES = ['Bank','Savings','Investment','Crypto','Cash','Other'];

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What was the name of your primary school?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the make of your first car?",
  "What is the name of the street you grew up on?",
];

export const DEFAULT_ACCOUNTS = [
  { id:1, name:'HSBC HK',       type:'Bank',       currency:'HKD', note:'' },
  { id:2, name:'HDFC India',     type:'Bank',       currency:'INR', note:'' },
  { id:3, name:'Kbank Thailand', type:'Bank',       currency:'THB', note:'' },
  { id:4, name:'Binance',        type:'Crypto',     currency:'USD', note:'' },
  { id:5, name:'Motilal Oswal',  type:'Investment', currency:'INR', note:'' },
  { id:6, name:'IBKR',           type:'Investment', currency:'USD', note:'' },
  { id:7, name:'MetaMask',       type:'Crypto',     currency:'USD', note:'' },
];

// Account type groupings for display
export const ACCOUNT_GROUPS = [
  { label:'Banks',           types:['Bank','Savings','Cash'] },
  { label:'Investments',     types:['Investment'] },
  { label:'Crypto / Other',  types:['Crypto','Other'] },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
export function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

export function fmt(v = 0, sym = '£', locale = 'en-GB', compact = false) {
  const n = Number(v) || 0;
  if (compact && Math.abs(n) >= 1000) return `${sym}${(n/1000).toFixed(1)}k`;
  return `${sym}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)}`;
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

export function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function getMonthsFromStart(i) {
  return [...ALL_MONTHS.slice(i), ...ALL_MONTHS.slice(0, i)];
}

export function getCurrentMonthAbbr() {
  return ALL_MONTHS[new Date().getMonth()];
}

// ─────────────────────────────────────────────
// Default state factory
// ─────────────────────────────────────────────
export const makeDefaultState = () => ({
  // Auth (stored per-year but only meaningful on most recent year row)
  userId: '', passwordHash: '', securityQuestion: '', securityAnswerHash: '',
  // Profile / settings
  displayName: '', currencyCode: 'GBP', yearStartMonth: 0,
  // Manual FX rates for unsupported currencies (e.g. { THB: 0.022 } means 1 THB = 0.022 home)
  manualFxRates: {},
  // Custom benchmark targets (default 50/30/20)
  benchmarkNeeds: 50, benchmarkWants: 30, benchmarkSavingsInvest: 20,
  // Plan: Income
  incomeSources: [{ id:1, label:'Salary', amount:3000 }],
  monthlyIncomeOverrides: {},
  // Plan: Allocation
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
  // Plan: Subscriptions
  subscriptions: [
    { id:1, label:'Gym Membership',              amount:0 },
    { id:2, label:'Streaming (Netflix/Spotify)',  amount:0 },
    { id:3, label:'Cloud Storage',               amount:0 },
  ],
  // Plan: starting balance, savings goal & net worth goal
  startingBalance: 0, goalSavings: 10000, goalNetWorth: 0,
  // Actuals
  actuals: {},
  // Accounts
  accounts: DEFAULT_ACCOUNTS,
  accountSnapshots: {},
  // Liabilities
  liabilities: [
    { id:1, label:'Mortgage Balance', amount:0 },
    { id:2, label:'Credit Card',      amount:0 },
    { id:3, label:'Student Loan',     amount:0 },
  ],
});

// ─────────────────────────────────────────────
// Shared inline styles
// ─────────────────────────────────────────────
export const s = {
  card:  { background:'#fff', border:'1px solid #e8e4dc', borderRadius:14, padding:'18px 20px' },
  label: { fontSize:10, color:'#9e9890', letterSpacing:'0.12em', fontWeight:600, margin:0 },
  input: { background:'#f9f7f3', border:'1px solid #e8e4dc', borderRadius:7, color:'#2d2a26', padding:'6px 10px', fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' },
  btn:   { width:'100%', background:'#2d2a26', color:'#f7f5f0', border:'none', borderRadius:8, padding:'10px', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnSec:{ width:'100%', background:'transparent', color:'#9e9890', border:'1px solid #e8e4dc', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
  btnDanger:{ width:'100%', background:'transparent', color:'#c94040', border:'1px solid #e8a598', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
};

// ─────────────────────────────────────────────
// Atom components
// ─────────────────────────────────────────────
export const Inp = ({ value, onChange, type='text', style={}, placeholder='', onKeyDown, disabled }) => (
  <input type={type} value={value} placeholder={placeholder} onKeyDown={onKeyDown} disabled={disabled}
    onChange={e => onChange(type==='number' ? (e.target.value === '' ? '' : (parseFloat(e.target.value) || 0)) : e.target.value)}
    style={{ ...s.input, ...style, opacity: disabled ? 0.5 : 1 }} />
);

export const Lbl = ({ children }) => <p style={{ ...s.label, marginBottom:6 }}>{children}</p>;

export const DelBtn = ({ onClick }) => (
  <button onClick={onClick} style={{ background:'none', border:'none', color:'#ccc', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 3px', flexShrink:0 }}>×</button>
);

export const AddBtn = ({ onClick, label='+ Add' }) => (
  <button onClick={onClick} style={{ fontSize:11, background:'transparent', border:'1px dashed #d8d4cc', borderRadius:7, padding:'5px 12px', cursor:'pointer', color:'#a09890', marginTop:8, width:'100%' }}>{label}</button>
);

export const Tag = ({ label, color }) => (
  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:color+'28', color, fontWeight:600, letterSpacing:'0.08em' }}>{label}</span>
);

export const Divider = () => <div style={{ borderTop:'1px solid #f0ece4', margin:'16px 0' }} />;

export const FG = ({ label, children }) => <div style={{ marginBottom:16 }}><Lbl>{label}</Lbl>{children}</div>;

export const Toast = ({ msg, type='success' }) => msg ? (
  <div style={{ fontSize:12, padding:'8px 12px', borderRadius:8, marginBottom:14,
    background: type==='success' ? '#f0fdf4' : '#fdf2f2',
    color: type==='success' ? '#2d9e6b' : '#c94040',
    border:`1px solid ${type==='success' ? '#bbf7d0':'#fecaca'}` }}>
    {type==='success' ? '✓ ' : '⚠ '}{msg}
  </div>
) : null;

export const TypeBadge = ({ type }) => {
  const colors = { Bank:'#7eb5d6', Savings:'#7ec8a0', Investment:'#b5a8d6', Crypto:'#f9a8d4', Cash:'#fdba74', Other:'#d5d0c9' };
  return <Tag label={type} color={colors[type] || '#d5d0c9'} />;
};

export const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)', fontSize:12 }}>
      <p style={{ color:'#9e9890', marginBottom:5, fontSize:10, letterSpacing:'0.1em' }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color||'#2d2a26', margin:'2px 0', fontWeight:600 }}>{p.name}: {p.value}</p>)}
    </div>
  );
};
