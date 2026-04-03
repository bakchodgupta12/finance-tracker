import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  saveData, loadData, loadLatestData, listYears, fetchFxRates, deleteUser, deleteYearData
} from './supabase';
import {
  TABS, getCurrency, fmt, getMonthsFromStart, makeDefaultState, s, Select,
  assignCategoryColours,
} from './shared';
import LoginScreen from './components/LoginScreen';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Plan from './components/Plan';
import Tracker from './components/ActualsMonth';
import Settings from './components/Settings';
import Investments from './components/Investments';

// ─────────────────────────────────────────────
// Sanitise numeric fields loaded from storage
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
  // Migrate: add investment fields if missing
  if (!out.investmentDeposits || typeof out.investmentDeposits !== 'object' || Array.isArray(out.investmentDeposits)) {
    out.investmentDeposits = {};
  }
  if (!out.investmentTrades || typeof out.investmentTrades !== 'object' || Array.isArray(out.investmentTrades)) {
    out.investmentTrades = {};
  }
  if (!out.investmentAccountVisibility || typeof out.investmentAccountVisibility !== 'object' || Array.isArray(out.investmentAccountVisibility)) {
    out.investmentAccountVisibility = {};
  }
  return out;
}

// ─────────────────────────────────────────────
// Remove snapshot data for months after current month (runs once at login)
// ─────────────────────────────────────────────
function sanitiseFutureSnapshots(data) {
  if (!data?.accountSnapshots) return data;
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const ALL_MONTHS_LOCAL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const cleanedSnapshots = { ...data.accountSnapshots };
  ALL_MONTHS_LOCAL.forEach((month, index) => {
    if (index > currentMonthIndex && cleanedSnapshots[month]) {
      delete cleanedSnapshots[month];
    }
  });
  return { ...data, accountSnapshots: cleanedSnapshots };
}

// ─────────────────────────────────────────────
// Sidebar icons
// ─────────────────────────────────────────────
const WalletIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M16 12h2" />
    <path d="M2 10h20" />
  </svg>
);

const TrendingIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const SunIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const ChevronLeft = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const PILLARS = [
  { id: 'finance',     label: 'Budget',      icon: WalletIcon  },
  { id: 'investments', label: 'Investments', icon: TrendingIcon },
  { id: 'life',        label: 'Habits',      icon: SunIcon      },
];

// ─────────────────────────────────────────────
// Life — Coming Soon
// ─────────────────────────────────────────────
function LifeComingSoon() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>🌱</div>
      <h2 style={{ fontFamily: 'Lora, serif', fontSize: 24, fontWeight: 400, color: '#1a1714', margin: 0 }}>
        Habits
      </h2>
      <p style={{ fontSize: 14, color: '#9e9890', textAlign: 'center', maxWidth: 300, margin: 0 }}>
        Daily habits, goals, and life tracking. Coming soon.
      </p>
    </div>
  );
}

export default function App() {
  const [state, setState]             = useState(makeDefaultState());
  const [tab, setTab]                 = useState('dashboard');
  const [saveStatus, setSaveStatus]   = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [displayTime, setDisplayTime] = useState('');
  const [loaded, setLoaded]           = useState(false);
  const [fxRates, setFxRates]         = useState({});
  const [fxLoading, setFxLoading]     = useState(false);
  const fxCacheRef                    = useRef({});
  const [onboardingData, setOnboardingData] = useState(null);

  // Sidebar
  const [activePillar,    setActivePillar]    = useState('finance');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [hoveredPillar,   setHoveredPillar]   = useState(null);

  // Investments sub-tab: 'overview' | String(accountId) | 'settings'
  const [investSubTab, setInvestSubTab] = useState('overview');

  // Year management
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [showNewYearConfirm, setShowNewYearConfirm] = useState(false);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [hoveredYear, setHoveredYear] = useState(null);
  const [yearToDelete, setYearToDelete] = useState(null);
  const yearDropdownRef = useRef(null);

  // Sub-tab navigation targets
  const [trackerTargetSubTab, setTrackerTargetSubTab] = useState(null);
  const [settingsTargetSubTab, setSettingsTargetSubTab] = useState(null);

  const set = useCallback((key, val) =>
    setState(prev => ({ ...prev, [key]: typeof val === 'function' ? val(prev[key]) : val }))
  , []);

  const currency = getCurrency(state.currencyCode || 'GBP');
  const f = useCallback((v) => fmt(v, currency.symbol, currency.locale), [currency]);

  // All investment accounts
  const allInvestmentAccounts = useMemo(
    () => (state.accounts || []).filter(a => a.type === 'Investment' || a.type === 'Crypto'),
    [state.accounts]
  );

  // Only accounts the user has toggled visible (default: true)
  const visibleInvestmentAccounts = useMemo(
    () => allInvestmentAccounts.filter(a => {
      const vis = (state.investmentAccountVisibility || {})[a.id];
      return vis === undefined || vis === true;
    }),
    [allInvestmentAccounts, state.investmentAccountVisibility]
  );

  // Sidebar width
  const sidebarWidth = sidebarExpanded ? 200 : 56;

  // Validate investSubTab whenever visible accounts change
  const validInvestSubTab = useMemo(() => {
    if (investSubTab === 'overview' || investSubTab === 'settings') return investSubTab;
    if (visibleInvestmentAccounts.some(a => String(a.id) === investSubTab)) return investSubTab;
    return 'overview';
  }, [investSubTab, visibleInvestmentAccounts]);

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
      console.log('FX source:', source === 'exchangerate-api' ? 'ExchangeRate-API' : source === 'frankfurter' ? 'frankfurter fallback' : 'empty (no rates)');
      if (source === 'exchangerate-api') {
        const month = new Date().toISOString().slice(0, 7);
        set('fxApiCallsThisMonth', prev => {
          const p = prev || { month: '', count: 0 };
          const newState = p.month !== month ? { month, count: 1 } : { ...p, count: p.count + 1 };
          console.log('FX API count:', newState.count);
          return newState;
        });
      }
    });
  }, [state.currencyCode, loaded]);

  // Close year dropdown when clicking outside
  useEffect(() => {
    if (!yearDropdownOpen) return;
    const handle = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setYearDropdownOpen(false);
        setYearToDelete(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [yearDropdownOpen]);

  // Convert any amount in fromCurrency to home currency
  const toHome = useCallback((amount, fromCurrency) => {
    if (!fromCurrency || fromCurrency === (state.currencyCode || 'GBP')) return amount;
    const rate = fxRates[fromCurrency];
    if (rate) return amount / rate;
    const manualRate = state.manualFxRates?.[fromCurrency];
    if (manualRate && manualRate > 0) return amount * manualRate;
    return null;
  }, [fxRates, state.currencyCode, state.manualFxRates]);

  const MONTHS = useMemo(() => getMonthsFromStart(state.yearStartMonth ?? 0), [state.yearStartMonth]);

  // Auto-save (year-scoped)
  useEffect(() => {
    if (!loaded || !state.userId) return;
    setSaveStatus('saving');
    const t = setTimeout(async () => {
      const { error } = await saveData(state.userId, selectedYear, state);
      if (error) {
        setSaveStatus('error');
      } else {
        setLastSavedAt(new Date());
        setSaveStatus('saved');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [state, loaded, selectedYear]);

  // Update relative timestamp every 30 seconds
  useEffect(() => {
    if (!lastSavedAt) return;
    const update = () => {
      const now = new Date();
      const diffMs = now - lastSavedAt;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 10) {
        setDisplayTime('just now');
      } else if (diffSecs < 60) {
        setDisplayTime(`${diffSecs}s ago`);
      } else if (diffMins === 1) {
        setDisplayTime('1 min ago');
      } else if (diffMins < 60) {
        setDisplayTime(`${diffMins} mins ago`);
      } else {
        setDisplayTime(lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // Login handler
  const handleLogin = useCallback(async (userId, existingData, year, pwHash, secQ, secAHash) => {
    const currentYear = new Date().getFullYear();

    if (existingData) {
      const DEFAULT_CAT_TYPES = {
        Rent:'Need', Groceries:'Need', Food:'Want', Transport:'Need', Utilities:'Need',
        Shopping:'Want', Entertainment:'Want', Travel:'Want', Drinks:'Want', Health:'Need',
      };
      const migratedData = {
        ...(existingData.expenseCategories ? {
          ...existingData,
          expenseCategories: (() => {
            const typeMigrated = existingData.expenseCategories.map(cat =>
              cat.type !== undefined ? cat : { ...cat, type: DEFAULT_CAT_TYPES[cat.name] || null }
            );
            // Only assign colours to categories that are missing one (legacy data).
            // Never overwrite colours that were manually saved by the user.
            const hasMissing = typeMigrated.some(c => !c.color);
            return hasMissing ? assignCategoryColours(typeMigrated) : typeMigrated;
          })(),
        } : existingData),
        expenses: (existingData.expenses || []).map(e => {
          let m = 'recurring' in e ? e : { ...e, recurring: false };
          if (!('recurringFrequency' in m)) m = { ...m, recurringFrequency: m.recurring ? 'monthly' : null };
          if (!('skippedMonths' in m)) m = { ...m, skippedMonths: [] };
          if (!('confirmedMonths' in m)) m = { ...m, confirmedMonths: [] };
          return m;
        }),
      };
      const sanitizedData = sanitizeNumericFields(migratedData);
      const cleanedData = sanitiseFutureSnapshots(sanitizedData);
      setState({ ...makeDefaultState(), ...cleanedData, userId });
      setSelectedYear(year || currentYear);
    } else {
      setOnboardingData({ userId, pwHash: pwHash || '', secQ: secQ || '', secAHash: secAHash || '' });
      setSelectedYear(currentYear);
      setAvailableYears([currentYear]);
      return;
    }

    const years = await listYears(userId);
    if (years.length > 0) {
      setAvailableYears(years);
    } else {
      setAvailableYears([currentYear]);
    }

    setLoaded(true);
  }, []);

  // Onboarding complete
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
    const preservedDismissed = state.checklistPermanentlyDismissed || false;
    const preservedTasksDone = state.checklistTasksDone || {};
    const { data } = await loadData(state.userId, year);
    if (data) {
      const loaded = sanitizeNumericFields(data);
      setState(prev => ({
        ...makeDefaultState(),
        ...loaded,
        userId: prev.userId,
        checklistPermanentlyDismissed: preservedDismissed || (loaded.checklistPermanentlyDismissed || false),
        checklistTasksDone: { ...preservedTasksDone, ...(loaded.checklistTasksDone || {}) },
      }));
    } else {
      setState(prev => ({
        ...makeDefaultState(),
        userId: prev.userId,
        checklistPermanentlyDismissed: preservedDismissed,
        checklistTasksDone: preservedTasksDone,
      }));
    }
    setSelectedYear(year);
    setYearLoading(false);
  }, [selectedYear, state.userId, state.checklistPermanentlyDismissed, state.checklistTasksDone]);

  // Create new year
  const createNewYear = useCallback(async () => {
    const newYear = Math.max(...availableYears, new Date().getFullYear()) + 1;
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
      incomeSources: JSON.parse(JSON.stringify(state.incomeSources)),
      allocation: JSON.parse(JSON.stringify(state.allocation)),
      subscriptions: JSON.parse(JSON.stringify(state.subscriptions)),
      accounts: JSON.parse(JSON.stringify(state.accounts)),
      liabilities: JSON.parse(JSON.stringify(state.liabilities)),
      secondaryAllocations: JSON.parse(JSON.stringify(state.secondaryAllocations || {})),
      goalSavings: state.goalSavings,
      goalNetWorth: state.goalNetWorth,
      checklistPermanentlyDismissed: state.checklistPermanentlyDismissed || false,
      checklistTasksDone: { ...(state.checklistTasksDone || {}) },
    };

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

    await saveData(state.userId, newYear, carryForward);
    setAvailableYears(prev => [newYear, ...prev]);
    setState(carryForward);
    setSelectedYear(newYear);
    setShowNewYearConfirm(false);
  }, [state, availableYears, MONTHS, toHome]);

  // Navigate to a tab, optionally targeting a sub-tab
  const navigate = useCallback((targetTab, subTab) => {
    setActivePillar('finance');
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

  const handleDeleteYear = useCallback(async (year) => {
    await deleteYearData(state.userId, year);
    const newAvailableYears = availableYears.filter(y => y !== year);
    setAvailableYears(newAvailableYears);
    if (selectedYear === year) {
      if (newAvailableYears.length > 0) {
        await switchYear(newAvailableYears[0]);
      } else {
        setState(prev => ({ ...makeDefaultState(), userId: prev.userId }));
      }
    }
  }, [state.userId, selectedYear, availableYears, switchYear]);

  // Derived calculations
  const baseIncome = state.incomeSources.reduce((sum, i) => {
    const c = toHome(Number(i.amount) || 0, i.currency || state.currencyCode || 'GBP');
    return sum + (c ?? 0);
  }, 0);
  const monthIncome = useCallback(m => state.monthlyIncomeOverrides[m] ?? baseIncome, [state.monthlyIncomeOverrides, baseIncome]);
  const allocByCat  = useMemo(() => {
    const map = {};
    for (const cat of ['Savings', 'Investments', 'Needs', 'Wants'])
      map[cat] = state.allocation.filter(a => a.category === cat).reduce((s, a) => s + (Number(a.pct) || 0), 0);
    return map;
  }, [state.allocation]);
  const totalAllocPct = Object.values(allocByCat).reduce((s, v) => s + (Number(v) || 0), 0);

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

  // Common props for Finance child components
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

  // ── Sub-tab bar content ──────────────────────────────────────────────────────
  const tabBtnStyle = (isActive) => ({
    background: 'none', border: 'none',
    borderBottom: isActive ? '2px solid #2d2a26' : '2px solid transparent',
    color: isActive ? '#1a1714' : '#a09890',
    cursor: 'pointer', padding: '12px 16px',
    fontSize: 12, fontWeight: isActive ? 600 : 400,
    textTransform: 'capitalize', fontFamily: 'inherit',
    letterSpacing: '0.02em', transition: 'color 0.15s', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: "'DM Sans', sans-serif", color: '#2d2a26' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* ── New Year Confirmation Modal ── */}
      {showNewYearConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── FIXED TOP BAR ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: '1px solid #e8e4dc', background: '#fff', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52,
      }}>
        <p style={{ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 500, color: '#1a1714' }}>
          {(state.displayName?.trim() || (state.userId ? state.userId.charAt(0).toUpperCase() + state.userId.slice(1).toLowerCase() : ''))}'s Finance Tracker
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Year selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative' }} ref={yearDropdownRef}>
              <button
                onClick={() => { setYearDropdownOpen(o => !o); setYearToDelete(null); }}
                style={{
                  background: '#f9f7f3', border: '1px solid #e8e4dc', borderRadius: 7,
                  padding: '4px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: '#2d2a26', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedYear}
                <span style={{ fontSize: 10, color: '#9e9890', lineHeight: 1 }}>▾</span>
              </button>

              {yearDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 150,
                  background: '#fff', border: '1px solid #e8e4dc', borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 190, overflow: 'hidden',
                }}>
                  {[...availableYears].sort((a, b) => b - a).map(year => {
                    const isCurrent = year === new Date().getFullYear();
                    const isConfirming = yearToDelete === year;
                    return (
                      <div key={year}>
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', cursor: 'pointer',
                            background: year === selectedYear ? '#f9f7f3' : 'transparent',
                          }}
                          onMouseEnter={() => setHoveredYear(year)}
                          onMouseLeave={() => setHoveredYear(null)}
                        >
                          <span
                            onClick={() => { switchYear(year); setYearDropdownOpen(false); setYearToDelete(null); }}
                            style={{ fontSize: 14, color: '#1a1714', flex: 1 }}
                          >
                            {year}
                            {isCurrent && <span style={{ fontSize: 11, color: '#9e9890', marginLeft: 6 }}>current</span>}
                          </span>
                          {!isCurrent && hoveredYear === year && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setYearToDelete(isConfirming ? null : year); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c94040', fontSize: 12, padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        {isConfirming && (
                          <div style={{ padding: '10px 12px', background: '#fdf2f2', borderTop: '1px solid #fecaca' }}>
                            <p style={{ fontSize: 12, color: '#6b6660', marginBottom: 8 }}>Delete all {year} data? This cannot be undone.</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => setYearToDelete(null)} style={{ background: 'transparent', border: '1px solid #e8e4dc', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#6b6660', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                              <button onClick={() => { setYearToDelete(null); setYearDropdownOpen(false); handleDeleteYear(year); }} style={{ background: '#c94040', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Delete {year}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowNewYearConfirm(true)}
              style={{
                background: 'none', border: '1px dashed #d8d4cc', borderRadius: 6,
                padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#a09890',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >+ New Year</button>
          </div>

          {/* Save status */}
          {saveStatus === 'saving' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9e9890' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b0aa9f', animation: 'pulse 1s infinite' }} />
              Saving…
            </div>
          )}
          {saveStatus === 'saved' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9e9890' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6dbb8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved · {displayTime}
            </div>
          )}
          {saveStatus === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#c94040' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c94040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Save failed · Retrying…
            </div>
          )}

          {yearLoading && <span style={{ fontSize: 11, color: '#b0aa9f' }}>Loading…</span>}
        </div>
      </div>

      {/* ── FIXED LEFT SIDEBAR ── */}
      <div style={{
        position: 'fixed', top: 52, left: 0, bottom: 0,
        width: sidebarWidth, background: '#fff',
        borderRight: '1px solid #e8e4dc',
        zIndex: 90, transition: 'width 0.2s ease',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Expand/collapse toggle at top */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: sidebarExpanded ? 'flex-end' : 'center',
          padding: '12px 12px 4px', marginBottom: 8,
          borderBottom: '1px solid #f0ece4',
        }}>
          <button
            onClick={() => setSidebarExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9e9890', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9f7f3'; e.currentTarget.style.color = '#1a1714'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9e9890'; }}
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarExpanded
                ? <polyline points="15 18 9 12 15 6" />
                : <polyline points="9 18 15 12 9 6" />
              }
            </svg>
          </button>
        </div>

        {/* Pillar items */}
        <div style={{ flex: 1 }}>
          {PILLARS.map(pillar => {
            const isActive  = activePillar === pillar.id;
            const isHovered = hoveredPillar === pillar.id;
            return (
              <div key={pillar.id} style={{ position: 'relative' }}>
                {sidebarExpanded ? (
                  /* ── Expanded item ── */
                  <div
                    onClick={() => setActivePillar(pillar.id)}
                    onMouseEnter={() => setHoveredPillar(pillar.id)}
                    onMouseLeave={() => setHoveredPillar(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', cursor: 'pointer', borderRadius: 8,
                      margin: '2px 8px', transition: 'background 0.15s',
                      background: isActive ? '#f7f5f0' : isHovered ? '#f9f7f3' : 'transparent',
                      borderLeft: isActive ? '3px solid #7eb5d6' : '3px solid transparent',
                    }}
                  >
                    <div style={{
                      width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center',
                      color: isActive ? '#1a1714' : '#6b6660',
                    }}>
                      {pillar.icon}
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#1a1714' : '#6b6660',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      {pillar.label}
                    </span>
                  </div>
                ) : (
                  /* ── Collapsed item — 40×40 centred box ── */
                  <div
                    onClick={() => setActivePillar(pillar.id)}
                    onMouseEnter={() => setHoveredPillar(pillar.id)}
                    onMouseLeave={() => setHoveredPillar(null)}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '2px auto', cursor: 'pointer',
                      background: isActive ? '#f0f4f8' : isHovered ? '#f9f7f3' : 'transparent',
                      border: isActive ? '1px solid #e0eaf2' : '1px solid transparent',
                      transition: 'all 0.15s', position: 'relative',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive ? '#5B9BD5' : '#9e9890',
                      transition: 'color 0.15s',
                    }}>
                      {pillar.icon}
                    </div>

                    {/* Active accent bar on sidebar left edge */}
                    {isActive && (
                      <div style={{
                        position: 'absolute', left: -8, top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3, height: 20,
                        borderRadius: '0 2px 2px 0',
                        background: '#7eb5d6',
                      }} />
                    )}

                    {/* Tooltip to the right */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute', left: '110%', top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#2d2a26', color: '#fff', fontSize: 11,
                        padding: '4px 10px', borderRadius: 5,
                        whiteSpace: 'nowrap', pointerEvents: 'none',
                        zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}>
                        {pillar.label}
                        <div style={{
                          position: 'absolute', right: '100%', top: '50%',
                          transform: 'translateY(-50%)',
                          width: 0, height: 0,
                          borderTop: '4px solid transparent',
                          borderBottom: '4px solid transparent',
                          borderRight: '4px solid #2d2a26',
                        }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* ── MAIN CONTENT (right of sidebar, below top bar) ── */}
      <div style={{
        marginLeft: sidebarWidth, paddingTop: 52,
        minHeight: '100vh', transition: 'margin-left 0.2s ease',
      }}>

        {/* Sub-tab bar */}
        <div style={{
          position: 'sticky', top: 52, zIndex: 50,
          background: '#fff', borderBottom: '1px solid #e8e4dc',
          padding: '0 24px', display: 'flex', overflowX: 'auto',
        }}>
          {activePillar === 'finance' && TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtnStyle(tab === t)}>{t}</button>
          ))}

          {activePillar === 'investments' && (
            <>
              <button onClick={() => setInvestSubTab('overview')} style={tabBtnStyle(validInvestSubTab === 'overview')}>
                Overview
              </button>
              {visibleInvestmentAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setInvestSubTab(String(acc.id))}
                  style={tabBtnStyle(validInvestSubTab === String(acc.id))}
                >
                  {acc.name}
                </button>
              ))}
              <button onClick={() => setInvestSubTab('settings')} style={tabBtnStyle(validInvestSubTab === 'settings')}>
                Settings
              </button>
            </>
          )}

          {activePillar === 'life' && (
            <div style={{ padding: '14px 0', fontSize: 12, color: '#b0aa9f' }}>Life</div>
          )}
        </div>

        {/* Page content */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px' }}>

          {/* ── Finance pillar ── */}
          {activePillar === 'finance' && (
            <>
              {tab === 'dashboard' && <Dashboard {...commonProps} />}
              {tab === 'plan'      && <Plan {...commonProps} totalAllocPct={totalAllocPct} />}
              {tab === 'tracker'   && <Tracker {...commonProps} />}
              {tab === 'settings'  && (
                <Settings
                  state={state} set={set}
                  onDeleteAccount={handleDeleteAccount}
                  onDeleteYear={handleDeleteYear}
                  onLogout={handleLogout}
                  availableYears={availableYears}
                  selectedYear={selectedYear}
                  settingsTargetSubTab={settingsTargetSubTab}
                  setSettingsTargetSubTab={setSettingsTargetSubTab}
                  navigate={navigate}
                />
              )}
            </>
          )}

          {/* ── Investments pillar ── */}
          {activePillar === 'investments' && (
            <Investments
              state={state}
              set={set}
              subTab={validInvestSubTab}
              allInvestmentAccounts={allInvestmentAccounts}
              visibleInvestmentAccounts={visibleInvestmentAccounts}
              accountSnapshots={state.accountSnapshots}
              MONTHS={MONTHS}
            />
          )}

          {/* ── Life pillar ── */}
          {activePillar === 'life' && <LifeComingSoon />}

        </div>
      </div>
    </div>
  );
}
