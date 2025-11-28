import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/supabase.config';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabase;
}

// Exposed for testing so specs can provide a stubbed client without touching the real network.
export function setSupabaseClient(client: SupabaseClient | null): void {
  supabase = client;
}
