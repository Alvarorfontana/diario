export const prerender = false;

import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { isAdmin } from '../../../lib/auth';
import { getArticulos } from '../../../lib/articles';
import { estadoDe, leerComentarios, moderar } from '../../../lib/comentarios';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

// Todos los comentarios (pendientes y aprobados), con el título de su nota
export const GET = async ({ request, locals }: any) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return json({ ok: false, error: 'No autorizado' }, 401);
	if (!env.GITHUB_PAT) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);

	try {
		const [{ comentarios }, notas] = await Promise.all([leerComentarios(env.GITHUB_PAT), getArticulos()]);
		const titulos = new Map(notas.map((n) => [n.slug, n.title]));
		const lista = comentarios
			.map((c) => ({ ...c, estado: estadoDe(c), tituloNota: titulos.get(c.articleId) ?? c.articleId }))
			.sort((a, b) => b.date.localeCompare(a.date));
		return json({ ok: true, comentarios: lista });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

// Aprobar o borrar: { id, accion: 'aprobar' | 'borrar' }
export const POST = async ({ request, locals }: any) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return json({ ok: false, error: 'No autorizado' }, 401);
	if (!env.GITHUB_PAT) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);

	const body = await request.json().catch(() => ({}));
	const id = String(body.id ?? '');
	const accion = body.accion;
	if (!id || (accion !== 'aprobar' && accion !== 'borrar')) return json({ ok: false, error: 'Pedido inválido' }, 400);

	try {
		const c = await moderar(env.GITHUB_PAT, id, accion);
		if (!c) return json({ ok: false, error: 'Ese comentario ya no existe' }, 404);
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};
