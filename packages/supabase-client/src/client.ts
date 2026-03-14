import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase-client] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use expo-secure-store for token persistence on native
    // This will be configured in apps/mobile where SecureStore is available
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
