import { createBrowserClient } from '@supabase/ssr';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zgdqqgsvmrmtqegjbgnx.supabase.co';
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_tdeEnxO2iZvxHEG6HOntqA_qmJAxOTh';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
