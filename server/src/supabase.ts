import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('??  Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.warn('??  Server will start but database operations will fail until variables are set');
}

if (!supabaseAnonKey) {
  console.warn('??  Missing Supabase anon key (SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY) for auth operations');
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

// Service role client for server-side data access (bypasses RLS)
export const supabase: SupabaseClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, clientOptions)
  : ({} as SupabaseClient); // Fallback to prevent immediate crash

// Auth client that can safely manage user sessions without mutating the admin client's session
export const supabaseAuth: SupabaseClient = supabaseUrl && (supabaseAnonKey || supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, clientOptions)
  : ({} as SupabaseClient);

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any) {
  if (error?.code === 'PGRST116') {
    return { error: 'Not found', status: 404 };
  }
  return { error: error?.message || 'Database error', status: 500 };
}
