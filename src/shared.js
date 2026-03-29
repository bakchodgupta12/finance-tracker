import React, { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────
// Input handlers
// ─────────────────────────────────────────────
export const blockNonNumeric = (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End',
  ];
  const isDigit = e.key >= '0' && e.key <= '9';
  const isDecimal = e.key === '.' && !e.currentTarget.value.includes('.');
  if (e.key === '-' || e.key === 'Subtract') {
    e.preventDefault();
    return;
  }
  if (!isDigit && !isDecimal && !allowed.includes(e.key)) {
    e.preventDefault();
  }
};

export const pasteNumericOnly = (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text');
  const numeric = text.replace(/[^0-9.]/g, '');
  const val = parseFloat(numeric);
  if (!isNaN(val) && val >= 0) {
    const nativeInput = e.target;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(nativeInput, String(val));
    nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
export const ALL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const TABS = ['dashboard','plan','tracker','net worth','settings'];

export const EXPENSE_CATEGORY_COLORS = [
  '#7eb5d6','#7ec8a0','#e8a598','#d6a8c8','#fdba74',
  '#f9a8d4','#b5a8d6','#e8c55a','#84a98c','#b0aa9f',
];
export const CAT_COLORS = { Savings:'#5B9BD5', Investments:'#6dbb8a', Needs:'#E8A838', Wants:'#D96B6B' };
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

// Coloured group header styles for account tables
export const GROUP_HEADER_STYLES = {
  'Banks':          { background:'#EFF6FF', color:'#3B82F6' },
  'Investments':    { background:'#F5F3FF', color:'#7C3AED' },
  'Crypto / Other': { background:'#FFF7ED', color:'#D97706' },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
export function getCurrency(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

export function fmtChart(value, symbol) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + symbol + (abs / 1_000_000).toFixed(1) + 'm';
  if (abs >= 1_000) return sign + symbol + (abs / 1_000).toFixed(1) + 'k';
  return sign + symbol + Math.round(abs);
}

export function fmt(v = 0, sym = '£', locale = 'en-GB') {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}m`;
  return `${sign}${sym}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(abs)}`;
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

export function getCurrencyFlag(code) {
  const flags = {
    GBP:'🇬🇧', USD:'🇺🇸', EUR:'🇪🇺', INR:'🇮🇳',
    AED:'🇦🇪', SGD:'🇸🇬', HKD:'🇭🇰', THB:'🇹🇭',
    CAD:'🇨🇦', AUD:'🇦🇺',
  };
  return flags[code] || '';
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
  // Feature modules
  modules: { income: true, expenses: true, trades: true },
  // Plan: Income
  incomeSources: [{ id:1, label:'Salary', amount:3000, currency:'GBP' }],
  monthlyIncomeOverrides: {},
  // Plan: Secondary allocations per additional income source
  secondaryAllocations: {},
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
    { id:1, label:'Rent',          amount:0 },
    { id:2, label:'Utilities',     amount:0 },
    { id:3, label:'Subscriptions', amount:0 },
  ],
  // Plan: starting balance, savings goal & net worth goal
  startingBalance: 0, goalSavings: 10000, goalNetWorth: 0,
  // Actuals
  actuals: {},
  // Accounts (empty by default — new users set up via onboarding)
  accounts: [],
  accountSnapshots: {},
  // Liabilities
  liabilities: [
    { id:1, label:'Mortgage Balance', amount:0, currency:'GBP' },
    { id:2, label:'Credit Card',      amount:0, currency:'GBP' },
    { id:3, label:'Student Loan',     amount:0, currency:'GBP' },
  ],
  // Expenses
  expenses: [],
  expenseCategories: [
    { id:1,  name:'Rent',          color:'#7eb5d6', type:'Need' },
    { id:2,  name:'Groceries',     color:'#7ec8a0', type:'Need' },
    { id:3,  name:'Food',          color:'#e8a598', type:'Want' },
    { id:4,  name:'Transport',     color:'#d6a8c8', type:'Need' },
    { id:5,  name:'Utilities',     color:'#fdba74', type:'Need' },
    { id:6,  name:'Shopping',      color:'#f9a8d4', type:'Want' },
    { id:7,  name:'Entertainment', color:'#b5a8d6', type:'Want' },
    { id:8,  name:'Travel',        color:'#60a5c8', type:'Want' },
    { id:9,  name:'Drinks',        color:'#e8c55a', type:'Want' },
    { id:10, name:'Health',        color:'#84a98c', type:'Need' },
    { id:11, name:'Other',         color:'#b0aa9f', type:null  },
  ],
  paymentMethods: [],
  // Auto-computed actuals from expenses (separate from manually entered actuals)
  expenseAutoActuals: {},
  // Per-source income actuals: { [month]: { [incomeSourceId]: amount } }
  incomeActuals: {},
  // FX API usage tracking
  fxApiCallsThisMonth: { month: '', count: 0 },
  // Financial health checkup usage
  checkupUsage: { month: '', count: 0 },
  // Onboarding / checklist
  onboardingCompleted: false,
  checklistDismissCount: 0,
  checklistPermanentlyDismissed: false,
  // Permanent record of which checklist tasks have ever been completed (year-agnostic)
  checklistTasksDone: {},
  // Investments: deposits and trades per account
  investmentDeposits: {},  // { [accountId]: [{ id, date, type, amount, currency, notes }] }
  investmentTrades: {},    // { [accountId]: [{ id, date, action, asset, quantity, price, total, currency, notes }] }
  // Investments: which accounts show as tabs (default true)
  investmentAccountVisibility: {},  // { [accountId]: true | false }
  // Investments: opening balance per account
  investmentOpeningBalances: {},    // { [accountId]: { amount, date, currency } }
});

// ─────────────────────────────────────────────
// Shared inline styles
// ─────────────────────────────────────────────
export const s = {
  card:  { background:'#fff', border:'1px solid #e8e4dc', borderRadius:14, padding:'22px 24px' },
  label: { fontSize:10, color:'#9e9890', letterSpacing:'0.12em', fontWeight:600, margin:0 },
  input: { background:'#f9f7f3', border:'1px solid #e8e4dc', borderRadius:7, color:'#2d2a26', padding:'9px 28px 9px 12px', fontSize:14, outline:'none', fontFamily:'inherit', width:'100%' },
  btn:   { width:'100%', background:'#2d2a26', color:'#f7f5f0', border:'none', borderRadius:8, padding:'10px', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnSec:{ width:'100%', background:'transparent', color:'#9e9890', border:'1px solid #e8e4dc', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
  btnDanger:{ width:'100%', background:'transparent', color:'#c94040', border:'1px solid #e8a598', borderRadius:8, padding:'9px', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
};

// ─────────────────────────────────────────────
// Atom components
// ─────────────────────────────────────────────
export const Inp = ({ value, onChange, type='text', style={}, placeholder='', onKeyDown, disabled }) => {
  const handleKeyDown = type === 'number'
    ? (e) => { blockNonNumeric(e); onKeyDown?.(e); }
    : onKeyDown;
  const extraProps = type === 'number' ? { min: 0, onPaste: pasteNumericOnly } : {};
  return (
    <input type={type} value={value} placeholder={placeholder} onKeyDown={handleKeyDown} disabled={disabled}
      onChange={e => onChange(type==='number' ? (e.target.value === '' ? '' : (parseFloat(e.target.value) || 0)) : e.target.value)}
      style={{ ...s.input, ...style, opacity: disabled ? 0.5 : 1 }}
      {...extraProps} />
  );
};

export const Select = ({ value, onChange, style = {}, children }) => {
  const { flex, width = '100%', ...restStyle } = style;
  return (
    <div style={{ position: 'relative', flex, width }}>
      <select value={value} onChange={onChange} style={{
        background: '#f9f7f3', border: '1px solid #e8e4dc', borderRadius: 7,
        color: '#2d2a26', fontFamily: 'inherit', outline: 'none',
        cursor: 'pointer', width: '100%', padding: '9px 12px', fontSize: 14,
        ...restStyle,
        appearance: 'none', WebkitAppearance: 'none', paddingRight: 28,
      }}>
        {children}
      </select>
      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9e9890', fontSize: 11 }}>▾</div>
    </div>
  );
};

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
  const colors = { Bank:'#3B82F6', Savings:'#7ec8a0', Investment:'#7C3AED', Crypto:'#D97706', Cash:'#9e9890', Other:'#d5d0c9' };
  return <Tag label={type} color={colors[type] || '#d5d0c9'} />;
};

export function EditableCell({
  value,
  onChange,
  placeholder = '—',
  prefix = '',
  suffix = '',
  width = 120,
  align = 'left',
  narrowEmpty = false,
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const hasValue = value !== null && value !== undefined && value !== '' && value !== 0;

  const formatNumber = (v) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(v));

  if (!editing) {
    if (narrowEmpty && !hasValue) {
      return (
        <div
          onClick={() => setEditing(true)}
          style={{ cursor: 'text', padding: '6px 4px', display: 'inline-block', userSelect: 'none' }}
          onMouseEnter={e => { const sp = e.currentTarget.querySelector('span'); if (sp) sp.style.borderBottomColor = '#9e9890'; }}
          onMouseLeave={e => { const sp = e.currentTarget.querySelector('span'); if (sp) sp.style.borderBottomColor = '#d5d0c8'; }}
        >
          <span style={{
            color: '#b0aa9f',
            borderBottom: '1px solid #d5d0c8',
            paddingBottom: '1px',
            display: 'inline-block',
            minWidth: 16,
            transition: 'border-color 0.15s',
          }}>—</span>
        </div>
      );
    }

    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          cursor: 'text',
          minWidth: width,
          padding: '4px 2px',
          borderBottom: '1px solid #d5d0c8',
          color: hasValue ? '#1a1714' : '#b0aa9f',
          fontWeight: hasValue ? 500 : 400,
          fontSize: 14,
          textAlign: align,
          display: 'inline-block',
          transition: 'border-color 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderBottomColor = '#9e9890'; }}
        onMouseLeave={e => { e.currentTarget.style.borderBottomColor = '#d5d0c8'; }}
      >
        {hasValue ? `${prefix}${formatNumber(value)}${suffix}` : placeholder}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min={0}
      value={value || ''}
      onChange={e => onChange(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
      onBlur={() => setEditing(false)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'Tab') setEditing(false);
        if (e.key === 'Escape') setEditing(false);
        blockNonNumeric(e);
      }}
      onPaste={pasteNumericOnly}
      style={{
        width: width,
        background: '#f9f7f3',
        border: '1px solid #7eb5d6',
        borderRadius: 7,
        color: '#1a1714',
        padding: '6px 10px',
        fontSize: 14,
        outline: 'none',
        fontFamily: 'inherit',
        textAlign: align,
        MozAppearance: 'textfield',
      }}
    />
  );
}

export const ChartTip = ({ active, payload, label, symbol }) => {
  if (!active || !payload?.length) return null;
  const formatVal = v => symbol ? fmtChart(v, symbol) : v;
  return (
    <div style={{ background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.07)', fontSize:12 }}>
      <p style={{ color:'#9e9890', marginBottom:5, fontSize:10, letterSpacing:'0.1em' }}>{label}</p>
      {payload.map((p,i) => <p key={i} style={{ color:p.color||'#2d2a26', margin:'2px 0', fontWeight:600 }}>{p.name}: {formatVal(p.value)}</p>)}
    </div>
  );
};
