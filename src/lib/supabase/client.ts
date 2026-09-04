import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types.ts';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder.supabase.co') &&
  !supabaseAnonKey.includes('placeholder-anon-key') &&
  !supabaseAnonKey.includes('your-anon-public-key')
);

/**
 * Standard Supabase client for client-side / authenticated React usage.
 * Automatically enforces Row Level Security (RLS) policies for the authenticated user.
 */
export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

