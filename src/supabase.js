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

export async function saveData(userId, data) {
  if (!supabase) return { error: 'No Supabase connection' };
  const { error } = await supabase
    .from('tracker_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return { error };
}

export async function loadData(userId) {
  if (!supabase) return { data: null, error: 'No Supabase connection' };
  const { data, error } = await supabase
    .from('tracker_data').select('data').eq('user_id', userId).single();
  return { data: data?.data ?? null, error };
}

export async function userExists(userId) {
  if (!supabase) return false;
  const { data } = await supabase
    .from('tracker_data').select('user_id').eq('user_id', userId).single();
  return !!data;
}

export async function verifyPassword(userId, password) {
  if (!supabase) return false;
  const hash = await hashPassword(password);
  const { data } = await supabase
    .from('tracker_data').select('data').eq('user_id', userId).single();
  return data?.data?.passwordHash === hash;
}

export async function verifySecurityAnswer(userId, answer) {
  if (!supabase) return { ok: false, question: null };
  const { data } = await supabase
    .from('tracker_data').select('data').eq('user_id', userId).single();
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
    .from('tracker_data').select('data').eq('user_id', userId).single();
  return data?.data?.securityQuestion || null;
}

// Fetch live FX rates — base currency to all others
// Uses frankfurter.app (free, no key needed)
export async function fetchFxRates(baseCurrency = 'GBP') {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
    const json = await res.json();
    return json.rates || {};
  } catch {
    return {};
  }
}
