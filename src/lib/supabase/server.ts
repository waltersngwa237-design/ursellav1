import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types.ts';

/**
 * Privileged server-side Supabase client.
 * Uses the SUPABASE_SERVICE_ROLE_KEY to perform admin/system operations
 * such as automated background AI insight generation or cron maintenance.
 * 
 * NEVER expose this client or its key to the browser!
 */
export function createServerAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment variables.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
