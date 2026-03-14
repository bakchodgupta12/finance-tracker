import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ── Save full tracker state for a user ──
export async function saveData(userId, data) {
  if (!supabase) return { error: 'No Supabase connection' };
  const { error } = await supabase
    .from('tracker_data')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return { error };
}

// ── Load tracker state for a user ──
export async function loadData(userId) {
  if (!supabase) return { data: null, error: 'No Supabase connection' };
  const { data, error } = await supabase
    .from('tracker_data')
    .select('data')
    .eq('user_id', userId)
    .single();
  return { data: data?.data ?? null, error };
}
