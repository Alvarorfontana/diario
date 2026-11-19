import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../lib/runtimeEnv';

export const prerender = false;

// Despertador de la Central de noticias (repo centro-informacion).
// Los horarios gratis de GitHub se atrasan horas o no se disparan; los de Vercel son puntuales.
// Vercel llama a esta ruta dos veces por día (ver "crons" en vercel.json) y acá se pide a
// GitHub que corra "Recolectar noticias". Al terminar, la Redacción automática arranca sola.
// Si alguien la abre a mano desde el navegador, no dispara nada: solo muestra si la clave sirve.

const REPO = 'Alvarorfontana/centro-informacion';
const WORKFLOW = 'recolectar.yml';

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

export const GET: APIRoute = async ({ request, locals }) => {
	const env = getRuntimeEnv(locals);
	const token = env.CENTRAL_GITHUB_TOKEN || env.GITHUB_PAT;
	if (!token) return json({ ok: false, error: 'Falta la clave de GitHub (GITHUB_PAT) en Vercel' }, 500);

	const gh = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'User-Agent': 'eldiario-despertador',
		'X-GitHub-Api-Version': '2022-11-28',
	};

	// ¿Es Vercel Cron? Si hay CRON_SECRET, Vercel lo manda como Bearer; si no, se reconoce por el agente.
	const auth = request.headers.get('authorization') || '';
	const ua = request.headers.get('user-agent') || '';
	const esCron = env.CRON_SECRET ? auth === `Bearer ${env.CRON_SECRET}` : ua.includes('vercel-cron');

	if (!esCron) {
		// Prueba sin efectos: ¿la clave puede ver el despertador de la Central?
		const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}`, { headers: gh });
		return json(
			r.ok
				? { ok: true, mensaje: '✅ La clave sirve: Vercel puede despertar la Central dos veces por día.' }
				: { ok: false, mensaje: '❌ La clave de GitHub del diario no tiene permiso sobre centro-informacion.', estado: r.status },
			r.ok ? 200 : 502
		);
	}

	const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
		method: 'POST',
		headers: { ...gh, 'Content-Type': 'application/json' },
		body: JSON.stringify({ ref: 'main' }),
	});
	if (r.status === 204) return json({ ok: true, mensaje: 'Central despertada: recolección en marcha' });
	const detalle = await r.text().catch(() => '');
	console.error('[despertar-central]', r.status, detalle);
	return json({ ok: false, estado: r.status, detalle: detalle.slice(0, 300) }, 502);
};
