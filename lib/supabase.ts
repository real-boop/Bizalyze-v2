import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

if (typeof window === 'undefined') {
  logger.debug("[DEBUG] SUPABASE_URL:", process.env.SUPABASE_URL);
  logger.debug("[DEBUG] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

// Only use NEXT_PUBLIC_ vars for the public client (browser)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Key is missing! Check your environment variables.");
}

// Public client: for use in client-side code (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// (Optional) For server-side admin use only:
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null; 