import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function hashPassword(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + '_ft_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function normaliseAnswer(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Year-scoped save/load ───────────────────

export async function saveData(userId, year, data) {
  if (!supabase) return { error: 'No Supabase connection' };
  const { error } = await supabase
    .from('tracker_data')
    .upsert(
      { user_id: userId, year, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year' }
    );
  return { error };
}

export async function loadData(userId, year) {
  if (!supabase) return { data: null, error: 'No Supabase connection' };
  const { data, error } = await supabase
    .from('tracker_data')
    .select('data')
    .eq('user_id', userId)
    .eq('year', year)
    .single();
  return { data: data?.data ?? null, error };
}

// Load the most recent year's data for a user (used on login)
export async function loadLatestData(userId) {
  if (!supabase) return { data: null, year: null, error: 'No Supabase connection' };
  const { data, error } = await supabase
    .from('tracker_data')
    .select('data, year')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .limit(1)
    .single();
  return { data: data?.data ?? null, year: data?.year ?? null, error };
}

// List all years that exist for a user (descending)
export async function listYears(userId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('tracker_data')
    .select('year')
    .eq('user_id', userId)
    .order('year', { ascending: false });
  return (data || []).map(r => r.year);
}

export async function userExists(userId) {
  if (!supabase) return false;
  const { data } = await supabase
    .from('tracker_data')
    .select('user_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return !!data;
}

export async function verifyPassword(userId, password) {
  if (!supabase) return false;
  const hash = await hashPassword(password);
  // Check the most recent year row for password
  const { data } = await supabase
    .from('tracker_data')
    .select('data')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .limit(1)
    .single();
  return data?.data?.passwordHash === hash;
}

export async function verifySecurityAnswer(userId, answer) {
  if (!supabase) return { ok: false, question: null };
  const { data } = await supabase
    .from('tracker_data')
    .select('data')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .limit(1)
    .single();
  if (!data?.data?.securityAnswerHash) return { ok: false, question: null };
  const answerHash = await hashPassword(normaliseAnswer(answer));
  return {
    ok: data.data.securityAnswerHash === answerHash,
    question: data.data.securityQuestion || null,
  };
}

export async function getSecurityQuestion(userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('tracker_data')
    .select('data')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .limit(1)
    .single();
  return data?.data?.securityQuestion || null;
}

// Delete all year rows for a user
export async function deleteUser(userId) {
  if (!supabase) return;
  await supabase.from('tracker_data').delete().eq('user_id', userId);
}

// Delete a specific year's data for a user
export async function deleteYearData(userId, year) {
  if (!supabase) return;
  await supabase.from('tracker_data').delete().eq('user_id', userId).eq('year', year);
}

// Fetch live FX rates — base currency to all others
// Primary: ExchangeRate-API; fallback: frankfurter.app
// Returns { rates: {}, source: 'exchangerate-api'|'frankfurter'|'empty' }
export async function fetchFxRates(baseCurrency = 'GBP') {
  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/latest/${baseCurrency}`);
    const json = await res.json();
    if (json.result === 'success' && json.conversion_rates) {
      return { rates: json.conversion_rates, source: 'exchangerate-api' };
    }
    console.log('ExchangeRate-API response status:', res.status, '| result:', json.result || 'missing', '| error:', json['error-type'] || 'none');
  } catch (err) {
    console.log('ExchangeRate-API fetch error:', err.message);
  }
  // Fallback to frankfurter
  console.log('Falling back to frankfurter.app...');
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
    const json = await res.json();
    return { rates: json.rates || {}, source: 'frankfurter' };
  } catch (err) {
    console.log('Frankfurter fetch error:', err.message);
  }
  return { rates: {}, source: 'empty' };
}
