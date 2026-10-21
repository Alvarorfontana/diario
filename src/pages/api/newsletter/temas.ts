export const prerender = false;
import { brevoConfig, TEMAS } from '../../../lib/brevo';

// Boletines temáticos disponibles: solo los que tienen su lista configurada en Vercel.
export const GET = async ({ locals }: { locals?: unknown }) => {
	const cfg = brevoConfig(locals);
	const temas = cfg ? TEMAS.filter((t) => cfg.temas[t.id]).map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })) : [];
	return new Response(JSON.stringify({ ok: true, temas }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, s-maxage=300' },
	});
};
