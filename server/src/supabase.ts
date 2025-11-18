import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.warn('⚠️  Server will start but database operations will fail until variables are set');
}

// Service role client for server-side operations (bypasses RLS)
export const supabase: SupabaseClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : ({} as SupabaseClient); // Fallback to prevent immediate crash

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any) {
  if (error?.code === 'PGRST116') {
    return { error: 'Not found', status: 404 };
  }
  return { error: error?.message || 'Database error', status: 500 };
}

