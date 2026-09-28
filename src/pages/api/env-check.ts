import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../lib/runtimeEnv';

export const GET: APIRoute = async ({ locals }) => {
  const env = getRuntimeEnv(locals);
  
  const url = env.SUPABASE_PROJECT_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY;
  const adminPass = env.ADMIN_PASSWORD;

  return new Response(JSON.stringify({
    ok: true,
    mensaje: "Diagnóstico de variables en Vercel",
    variables: {
      SUPABASE_PROJECT_URL: url ? `✅ Presente. Inicia: ${url.substring(0, 35)}...` : '❌ AUSENTE',
      SUPABASE_SECRET_KEY: secret ? `✅ Presente. INICIA CON: "${secret.substring(0, 12)}..."` : '❌ AUSENTE',
      SUPABASE_PUBLISHABLE_KEY: publishable ? `✅ Presente.` : '❌ AUSENTE',
      ADMIN_PASSWORD: adminPass ? '✅ Presente' : '❌ AUSENTE',
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
