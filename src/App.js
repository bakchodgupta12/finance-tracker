import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  saveData, loadData, loadLatestData, listYears, fetchFxRates, deleteUser
} from './supabase';
import {
  TABS, getCurrency, fmt, getMonthsFromStart, makeDefaultState, s, Select
} from './shared';
import LoginScreen from './components/LoginScreen';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Plan from './components/Plan';
import Tracker from './components/ActualsMonth';
import NetWorth from './components/NetWorth';
import Settings from './components/Settings';

// ─────────────────────────────────────────────
// Sanitise numeric fields loaded from storage
// Prevents '' or NaN in state from crashing arithmetic
// ─────────────────────────────────────────────
function sanitizeNumericFields(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  const homeCode = out.currencyCode || 'GBP';
  if (Array.isArray(out.allocation)) {
    out.allocation = out.allocation.map(a => ({ ...a, pct: Number(a.pct) || 0 }));
  }
  if (Array.isArray(out.incomeSources)) {
    out.incomeSources = out.incomeSources.map(s => ({
      ...s, amount: Number(s.amount) || 0, currency: s.currency || homeCode,
    }));
  }
  if (Array.isArray(out.liabilities)) {
    out.liabilities = out.liabilities.map(l => ({
      ...l, amount: Number(l.amount) || 0, currency: l.currency || homeCode,
    }));
  }
  if (Array.isArray(out.subscriptions)) {
    out.subscriptions = out.subscriptions.map(s => ({ ...s, amount: Number(s.amount) || 0 }));
  }
  out.startingBalance = Number(out.startingBalance) || 0;
  out.goalSavings     = Number(out.goalSavings)     || 0;
  out.goalNetWorth    = Number(out.goalNetWorth)     || 0;
  if (!out.secondaryAllocations || typeof out.secondaryAllocations !== 'object' || Array.isArray(out.secondaryAllocations)) {
    out.secondaryAllocations = {};
  }
  if (!out.fxApiCallsThisMonth || typeof out.fxApiCallsThisMonth !== 'object') {
    out.fxApiCallsThisMonth = { month: '', count: 0 };
  }
  if (!out.incomeActuals || typeof out.incomeActuals !== 'object') {
    out.incomeActuals = {};
  }
  if (!out.checkupUsage || typeof out.checkupUsage !== 'object') {
    out.checkupUsage = { month: '', count: 0 };
  }
  return out;
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const [state, setState]             = useState(makeDefaultState());
  const [tab, setTab]                 = useState('dashboard');
  const [saveStatus, setSaveStatus]   = useState('');
  const [loaded, setLoaded]           = useState(false);
  const [fxRates, setFxRates]         = useState({});
  const [fxLoading, setFxLoading]     = useState(false);
  const fxCacheRef                    = useRef({});
  const [onboardingData, setOnboardingData] = useState(null);

  // Year management
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [showNewYearConfirm, setShowNewYearConfirm] = useState(false);
  const [yearLoading, setYearLoading] = useState(false);

  // Sub-tab navigation targets (set by navigate(), consumed by child components)
  const [trackerTargetSubTab, setTrackerTargetSubTab] = useState(null);
  const [settingsTargetSubTab, setSettingsTargetSubTab] = useState(null);

  const set = useCallback((key, val) =>
    setState(prev => ({ ...prev, [key]: typeof val === 'function' ? val(prev[key]) : val }))
  , []);

  const currency = getCurrency(state.currencyCode || 'GBP');
  const f = useCallback((v) => fmt(v, currency.symbol, currency.locale), [currency]);

  // Fetch FX rates whenever home currency changes
  useEffect(() => {
    if (!loaded) return;
    const code = state.currencyCode || 'GBP';
    if (fxCacheRef.current[code]) { setFxRates(fxCacheRef.current[code]); return; }
    setFxLoading(true);
    fetchFxRates(code).then(({ rates, source }) => {
      fxCacheRef.current[code] = rates;
      setFxRates(rates);
      setFxLoading(false);
      if (source === 'exchangerate-api') {
        const month = new Date().toISOString().slice(0, 7);
        setState(prev => {
          const p = prev.fxApiCallsThisMonth || { month: '', count: 0 };
          const next = p.month !== month ? { month, count: 1 } : { ...p, count: p.count + 1 };
          return { ...prev, fxApiCallsThisMonth: next };
        });
      }
    });
  }, [state.currencyCode, loaded]);

  // Convert any amount in fromCurrency to home currency
  // Uses live FX rates first, falls back to manual rates
  const toHome = useCallback((amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === (state.currencyCode || 'GBP')) return amount;
    const rate = fxRates[fromCurrency];
    if (rate) return amount / rate;
    // Fall back to manual rate
    const manualRate = state.manualFxRates?.[fromCurrency];
    if (manualRate && manualRate > 0) return amount * manualRate;
    return null; // unknown rate
  }, [fxRates, state.currencyCode, state.manualFxRates]);

  const MONTHS = useMemo(() => getMonthsFromStart(state.yearStartMonth ?? 0), [state.yearStartMonth]);

  // Auto-save (year-scoped)
  useEffect(() => {
    if (!loaded || !state.userId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const { error } = await saveData(state.userId, selectedYear, state);
      setSaveStatus(error ? 'error' : 'saved');
      if (!error) setTimeout(() => setSaveStatus(''), 2500);
    }, 1200);
    return () => clearTimeout(t);
  }, [state, loaded, selectedYear]);

  // Login handler
  const handleLogin = useCallback(async (userId, existingData, year, pwHash, secQ, secAHash) => {
    const currentYear = new Date().getFullYear();

    if (existingData) {
      // Returning user — load their data for the given year
      // Migrate expenseCategories: add type field if missing
      const DEFAULT_CAT_TYPES = {
        Rent:'Need', Groceries:'Need', Food:'Want', Transport:'Need', Utilities:'Need',
        Shopping:'Want', Entertainment:'Want', Travel:'Want', Drinks:'Want', Health:'Need',
      };
      const migratedData = {
        ...(existingData.expenseCategories ? {
          ...existingData,
          expenseCategories: existingData.expenseCategories.map(cat =>
            cat.type !== undefined ? cat : { ...cat, type: DEFAULT_CAT_TYPES[cat.name] || null }
          ),
        } : existingData),
        expenses: (existingData.expenses || []).map(e =>
          'recurring' in e ? e : { ...e, recurring: false }
        ),
      };
      const sanitizedData = sanitizeNumericFields(migratedData);
      setState({ ...makeDefaultState(), ...sanitizedData, userId });
      setSelectedYear(year || currentYear);
    } else {
      // New user — show onboarding before entering the app
      setOnboardingData({ userId, pwHash: pwHash || '', secQ: secQ || '', secAHash: secAHash || '' });
      setSelectedYear(currentYear);
      setAvailableYears([currentYear]);
      return; // don't set loaded yet
    }

    // Load available years
    const years = await listYears(userId);
    if (years.length > 0) {
      setAvailableYears(years);
    } else {
      setAvailableYears([currentYear]);
    }

    setLoaded(true);
  }, []);

  // Onboarding complete — save initial state and enter app
  const handleOnboardingComplete = useCallback(async ({ currency, modules, account }) => {
    const currentYear = new Date().getFullYear();
    const newState = {
      ...makeDefaultState(),
      userId: onboardingData.userId,
      passwordHash: onboardingData.pwHash,
      securityQuestion: onboardingData.secQ,
      securityAnswerHash: onboardingData.secAHash,
      currencyCode: currency,
      modules,
      accounts: account ? [account] : [],
    };
    setState(newState);
    setOnboardingData(null);
    setLoaded(true);
    await saveData(onboardingData.userId, currentYear, newState);
  }, [onboardingData]);

  // Switch year
  const switchYear = useCallback(async (year) => {
    if (year === selectedYear) return;
    setYearLoading(true);
    const { data } = await loadData(state.userId, year);
    if (data) {
      setState(prev => ({ ...makeDefaultState(), ...sanitizeNumericFields(data), userId: prev.userId }));
    } else {
      setState(prev => ({ ...makeDefaultState(), userId: prev.userId }));
    }
    setSelectedYear(year);
    setYearLoading(false);
  }, [selectedYear, state.userId]);

  // Create new year — carry forward plan data
  const createNewYear = useCallback(async () => {
    const newYear = Math.max(...availableYears, new Date().getFullYear()) + 1;

    // Carry forward plan data from current year
    const carryForward = {
      ...makeDefaultState(),
      userId: state.userId,
      passwordHash: state.passwordHash,
      securityQuestion: state.securityQuestion,
      securityAnswerHash: state.securityAnswerHash,
      displayName: state.displayName,
      currencyCode: state.currencyCode,
      yearStartMonth: state.yearStartMonth,
      manualFxRates: state.manualFxRates,
      benchmarkNeeds: state.benchmarkNeeds,
      benchmarkWants: state.benchmarkWants,
      benchmarkSavingsInvest: state.benchmarkSavingsInvest,
      // Plan data carried forward
      incomeSources: JSON.parse(JSON.stringify(state.incomeSources)),
      allocation: JSON.parse(JSON.stringify(state.allocation)),
      subscriptions: JSON.parse(JSON.stringify(state.subscriptions)),
      accounts: JSON.parse(JSON.stringify(state.accounts)),
      liabilities: JSON.parse(JSON.stringify(state.liabilities)),
      secondaryAllocations: JSON.parse(JSON.stringify(state.secondaryAllocations || {})),
      goalSavings: state.goalSavings,
      goalNetWorth: state.goalNetWorth,
    };

    // Pre-fill starting balance from previous year's December closing
    // Find the last month of the financial year in current data
    const lastMonth = MONTHS[MONTHS.length - 1];
    const decSnap = state.accountSnapshots?.[lastMonth];
    if (decSnap) {
      const closingBalance = (state.accounts || []).reduce((sum, acc) => {
        const v = decSnap[acc.id] || 0;
        const h = toHome(v, acc.currency);
        return sum + (h ?? 0);
      }, 0);
      carryForward.startingBalance = Math.round(closingBalance);
    }

    // Save and switch
    await saveData(state.userId, newYear, carryForward);
    setAvailableYears(prev => [newYear, ...prev]);
    setState(carryForward);
    setSelectedYear(newYear);
    setShowNewYearConfirm(false);
  }, [state, availableYears, MONTHS, toHome]);

  // Navigate to a tab, optionally targeting a specific sub-tab
  const navigate = useCallback((targetTab, subTab) => {
    setTab(targetTab);
    if (subTab) {
      if (targetTab === 'tracker')  setTrackerTargetSubTab(subTab);
      if (targetTab === 'settings') setSettingsTargetSubTab(subTab);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setLoaded(false);
    setState(makeDefaultState());
    setAvailableYears([]);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    await deleteUser(state.userId);
    handleLogout();
  }, [state.userId, handleLogout]);

  // Derived calculations
  const baseIncome     = state.incomeSources.reduce((sum, i) => {
    const c = toHome(Number(i.amount) || 0, i.currency || state.currencyCode || 'GBP');
    return sum + (c ?? 0);
  }, 0);
  const monthIncome    = useCallback(m => state.monthlyIncomeOverrides[m] ?? baseIncome, [state.monthlyIncomeOverrides, baseIncome]);
  const allocByCat     = useMemo(() => {
    const map = {};
    for (const cat of ['Savings', 'Investments', 'Needs', 'Wants'])
      map[cat] = state.allocation.filter(a => a.category === cat).reduce((s, a) => s + (Number(a.pct) || 0), 0);
    return map;
  }, [state.allocation]);
  const totalAllocPct  = Object.values(allocByCat).reduce((s, v) => s + (Number(v) || 0), 0);

  // Net worth from account snapshots (latest month with data)
  const latestSnapshots = useMemo(() => {
    for (let i = MONTHS.length - 1; i >= 0; i--) {
      const snap = state.accountSnapshots?.[MONTHS[i]];
      if (snap && Object.values(snap).some(v => v > 0)) return snap;
    }
    return null;
  }, [state.accountSnapshots, MONTHS]);

  const accountsNetWorth = useMemo(() => {
    if (!latestSnapshots) return 0;
    return (state.accounts || []).reduce((sum, acc) => {
      const bal = latestSnapshots[acc.id] || 0;
      const inHome = toHome(bal, acc.currency);
      return sum + (inHome ?? 0);
    }, 0);
  }, [latestSnapshots, state.accounts, toHome]);

  const totalLiabilities = state.liabilities.reduce((sum, l) => {
    const c = toHome(Number(l.amount) || 0, l.currency || state.currencyCode || 'GBP');
    return sum + (c ?? 0);
  }, 0);
  const netWorth = accountsNetWorth - totalLiabilities;

  // Common props for child components
  const commonProps = {
    state, set, f, currency, MONTHS, baseIncome, allocByCat, monthIncome,
    toHome, fxRates, fxLoading, selectedYear,
    netWorth, accountsNetWorth, totalLiabilities, latestSnapshots,
    modules: state.modules || { income: true, expenses: true, trades: true },
    navigate,
    trackerTargetSubTab, setTrackerTargetSubTab,
    settingsTargetSubTab, setSettingsTargetSubTab,
  };

  if (!loaded && !onboardingData) return <LoginScreen onLogin={handleLogin} />;
  if (!loaded && onboardingData) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: "'DM Sans', sans-serif", color: '#2d2a26' }}>

      {/* New Year Confirmation Modal */}
      {showNewYearConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowNewYearConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ ...s.card, position: 'relative', maxWidth: 420, width: '100%', padding: '24px', zIndex: 1 }}>
            <p style={{ fontFamily: 'Lora, serif', fontSize: 18, color: '#1a1714', marginBottom: 8 }}>Create New Year</p>
            <p style={{ fontSize: 13, color: '#6b6660', marginBottom: 16 }}>
              This will create a {Math.max(...availableYears, new Date().getFullYear()) + 1} entry with your current plan data (income, allocation, accounts, subscriptions) carried forward.
              {state.accountSnapshots?.[MONTHS[MONTHS.length - 1]] && (
                <> January's opening balance will be pre-filled from {MONTHS[MONTHS.length - 1]}'s closing balance.</>
              )}
            </p>
            <button onClick={createNewYear} style={s.btn}>Create {Math.max(...availableYears, new Date().getFullYear()) + 1} →</button>
            <button onClick={() => setShowNewYearConfirm(false)} style={s.btnSec}>Cancel</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid #e8e4dc', background: '#fff', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52, position: 'sticky', top: 0, zIndex: 10
      }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 500, color: '#1a1714' }}>
          {(state.displayName?.trim() || (state.userId ? state.userId.charAt(0).toUpperCase() + state.userId.slice(1).toLowerCase() : ''))}'s Finance Tracker
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Year selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Select
              value={selectedYear}
              onChange={e => switchYear(Number(e.target.value))}
              style={{ width: 'auto', padding: '4px 8px', fontSize: 13, fontWeight: 600 }}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
            <button
              onClick={() => setShowNewYearConfirm(true)}
              style={{
                background: 'none', border: '1px dashed #d8d4cc', borderRadius: 6,
                padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#a09890',
                fontFamily: 'inherit', whiteSpace: 'nowrap'
              }}
            >+ New Year</button>
          </div>

          {/* Save status */}
          <span style={{ fontSize: 11, color: saveStatus === 'error' ? '#c94040' : '#b0aa9f', minWidth: 70 }}>
            {saveStatus === 'saving' && '⟳ Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
          </span>

          {yearLoading && <span style={{ fontSize: 11, color: '#b0aa9f' }}>Loading…</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #e8e4dc', background: '#fff', padding: '0 24px', display: 'flex' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #2d2a26' : '2px solid transparent',
            color: tab === t ? '#1a1714' : '#a09890', cursor: 'pointer', padding: '12px 16px',
            fontSize: 12, fontWeight: tab === t ? 600 : 400, textTransform: 'capitalize',
            fontFamily: 'inherit', letterSpacing: '0.02em', transition: 'color 0.15s',
            whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>

        {tab === 'dashboard' && (
          <Dashboard {...commonProps} />
        )}

        {tab === 'plan' && (
          <Plan {...commonProps} totalAllocPct={totalAllocPct} />
        )}

        {tab === 'tracker' && (
          <Tracker {...commonProps} />
        )}

        {tab === 'net worth' && (
          <NetWorth {...commonProps} />
        )}

        {tab === 'settings' && (
          <Settings
            state={state} set={set}
            onDeleteAccount={handleDeleteAccount}
            onLogout={handleLogout}
          />
        )}

      </div>
    </div>
  );
}
