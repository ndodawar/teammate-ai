import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Read at call time so a Next.js server that loads env after module init still sees them.
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  }

  return createClient(url, key);
}

// 12 random bytes render to 24 hex chars, comfortably above PRD's 10-char floor.
export function generateProjectCode(): string {
  return randomBytes(12).toString('hex');
}
