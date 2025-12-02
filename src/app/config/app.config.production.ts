import { AppConfig } from './app.config.types';

export const APP_VERSION = '0.0.1';

export const appConfig: AppConfig = {
  version: APP_VERSION,
  supabase: {
    url: 'https://wqieplruslupjlxfpeqq.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxaWVwbHJ1c2x1cGpseGZwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNDAwOTQsImV4cCI6MjA3OTYxNjA5NH0.RsR3rjdOa5KYFh5ew-5l4AZjQxxgXEpb4m9tY7da6po',
    redirectUrl: 'https://app.wdoc.info',
  },
};

export const supabaseConfig = appConfig.supabase;
