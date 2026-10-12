import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../lib/runtimeEnv';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const env = getRuntimeEnv(locals);
	const ok = (v?: string) => (v ? '✅ Presente' : '❌ AUSENTE');
	return new Response(
		JSON.stringify({
			ok: true,
			mensaje: 'Diagnóstico de variables en Vercel',
			variables: { ADMIN_PASSWORD: ok(env.ADMIN_PASSWORD), GITHUB_PAT: ok(env.GITHUB_PAT), DATA_REPO: env.DATA_REPO ? '✅ ' + env.DATA_REPO + ' (comentarios, suscripciones, publicidad y fotos fuera del repo del sitio)' : '⚠️ sin configurar: los datos se guardan en el repo del sitio y cada cambio despliega' },
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
};
