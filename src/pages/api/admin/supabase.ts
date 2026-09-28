import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';

// Caché por request para no recrear el cliente en cada llamada
let cachedClient: SupabaseClient | null = null;
let cachedLocalsKey: string | null = null;

export function getSupabase(locals?: any): SupabaseClient {
  const env = getRuntimeEnv(locals);
  
  const url = env.SUPABASE_PROJECT_URL;
  const key = env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      `Faltan variables de Supabase. URL: ${url ? '✅' : '❌'} | Key: ${key ? '✅' : '❌'}`
    );
  }

  // Reutilizar cliente si las credenciales son las mismas
  const localsKey = JSON.stringify(locals);
  if (cachedClient && cachedLocalsKey === localsKey) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  cachedLocalsKey = localsKey;
  return cachedClient;
}

// Export por compatibilidad (NO usar en handlers nuevos)
export const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SECRET_KEY || 'placeholder'
);
