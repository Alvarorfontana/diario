export type RuntimeEnv = Record<string, string | undefined>;

export function getRuntimeEnv(locals?: any): RuntimeEnv {
  // 1. VERCEL / NODE.JS: Fuente de verdad absoluta en runtime.
  if (typeof process !== 'undefined' && process.env) {
    return process.env as RuntimeEnv;
  }
  
  // 2. CLOUDFLARE WORKERS: Solo si no estamos en Node/Vercel.
  if (locals?.runtime?.env) {
    return locals.runtime.env as RuntimeEnv;
  }

  // 3. LOCAL / BUILD TIME.
  return (import.meta.env ?? {}) as unknown as RuntimeEnv;
}
