export const prerender = false;

import { getRuntimeEnv } from '../../lib/runtimeEnv';
import { getArticulo } from '../../lib/articles';
import { notifyNewComment } from '../../lib/email';
import { estadoDe, leerComentarios, linkModeracion, modificarComentarios, type Comentario } from '../../lib/comentarios';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

// Comentarios aprobados de una nota (lo que ve el público)
export const GET = async ({ request, locals }: any) => {
	const articleId = new URL(request.url).searchParams.get('articleId');
	if (!articleId) return json({ ok: false, error: 'Falta articleId' }, 400);

	const token = getRuntimeEnv(locals).GITHUB_PAT;
	if (!token) return json({ ok: false, error: 'GITHUB_PAT no configurado' }, 500);

	try {
		const { comentarios } = await leerComentarios(token);
		const visibles = comentarios
			.filter((c) => c.articleId === articleId && estadoDe(c) === 'aprobado')
			.map(({ id, author, text, date }) => ({ id, author, text, date }));
		return json(visibles);
	} catch {
		return json([]);
	}
};

// Comentario nuevo: queda pendiente y se avisa por mail
export const POST = async ({ request, locals }: any) => {
	const env = getRuntimeEnv(locals);
	const token = env.GITHUB_PAT;
	if (!token) return json({ ok: false, error: 'GITHUB_PAT no configurado' }, 500);

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Datos inválidos' }, 400);
	}

	// Campo trampa invisible: los robots lo llenan, las personas no
	if (body.web) return json({ ok: true, pendiente: true });

	const articleId = String(body.articleId ?? '').trim();
	const author = String(body.author ?? '').trim().slice(0, 50);
	const text = String(body.text ?? '').trim().slice(0, 1000);
	if (!articleId || !author || !text) return json({ ok: false, error: 'Completá tu nombre y el comentario.' }, 400);

	const nota = await getArticulo(articleId).catch(() => undefined);
	if (!nota) return json({ ok: false, error: 'La nota no existe.' }, 404);

	const nuevo: Comentario = {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		articleId,
		author,
		text,
		date: new Date().toISOString(),
		estado: 'pendiente',
	};

	try {
		await modificarComentarios(token, 'Comentario nuevo (pendiente)', (lista) => {
			lista.push(nuevo);
		});
	} catch (e: any) {
		console.error('No se pudo guardar el comentario:', e?.message);
		return json({ ok: false, error: 'No se pudo enviar el comentario. Probá de nuevo en un rato.' }, 500);
	}

	// Aviso por mail (se espera: en Vercel, lo que queda corriendo después de responder se corta)
	const origen = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
	if (env.ADMIN_PASSWORD) {
		try {
			await notifyNewComment(
				{
					tituloNota: nota.title,
					autor: author,
					texto: text,
					urlNota: `${origen}/articulo/${articleId}/`,
					urlAprobar: await linkModeracion(origen, env.ADMIN_PASSWORD, nuevo.id, 'aprobar'),
					urlBorrar: await linkModeracion(origen, env.ADMIN_PASSWORD, nuevo.id, 'borrar'),
					urlPanel: `${origen}/admin/comentarios/`,
				},
				{ apiKey: env.RESEND_API_KEY, notifyEmail: env.NOTIFY_EMAIL, from: env.RESEND_FROM },
			);
		} catch (e: any) {
			console.error('Aviso de comentario:', e?.message);
		}
	}

	return json({ ok: true, pendiente: true });
};
