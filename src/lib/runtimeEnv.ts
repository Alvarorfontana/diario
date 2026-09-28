type RuntimeEnv = Record<string, string | undefined>;

export function getRuntimeEnv(locals?: any): RuntimeEnv {
	// 1. Cloudflare (locals.runtime.env)
	const runtimeEnv = (locals as any)?.runtime?.env;
	if (runtimeEnv && typeof runtimeEnv === 'object') return runtimeEnv;

	// 2. Node / Vercel (process.env) ← ESTA PARTE ES LA QUE FALTA
	if (typeof process !== 'undefined' && process.env) {
		return process.env as RuntimeEnv;
	}

	// 3. Fallback a import.meta.env
	return import.meta.env as unknown as RuntimeEnv;
}
