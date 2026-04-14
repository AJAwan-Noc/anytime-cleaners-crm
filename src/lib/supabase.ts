import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ksjzsatctuxjgdrpovxd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzanpzYXRjdHV4amdkcnBvdnhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzQ4MzQsImV4cCI6MjA5MTQxMDgzNH0.5tikykBSUMLc6cFQrMpQS0OI7RhjuHcgSNW98vM27ZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://n8nautomations.noctix.app/webhook';
