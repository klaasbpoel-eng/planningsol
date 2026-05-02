// External Supabase client — points to project sbngjpnvxwwlchenyhhy
// This client is used in place of the auto-generated Lovable Cloud client
// via Vite alias in vite.config.ts.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://sbngjpnvxwwlchenyhhy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmdqcG52eHd3bGNoZW55aGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjQwNzQsImV4cCI6MjA4ODMwMDA3NH0.WLt_Sx3cALHTO5qy0A17i3SjsDzz6pgW8sa3mbiQA_c";

export const SUPABASE_PROJECT_REF = "sbngjpnvxwwlchenyhhy";
export const SUPABASE_FUNCTIONS_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
