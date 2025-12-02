export interface SupabaseConfig {
  url: string;
  anonKey: string;
  redirectUrl: string;
}

export interface AppConfig {
  version: string;
  supabase: SupabaseConfig;
}
