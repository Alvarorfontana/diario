export const prerender = false;
import { sumarVisita } from '../../lib/visitas';

// Suma una visita a una nota. La llama la página de la nota desde el navegador del lector
// (así no cuentan los robots que no ejecutan JavaScript).
export const POST = async ({ request, locals }: { request: Request; locals?: unknown }) => {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const slug = String(body.slug ?? '');
	if (!/^[a-z0-9._-]{1,160}$/i.test(slug)) {
		return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'content-type': 'application/json' } });
	}
	const ok = await sumarVisita(slug, locals);
	return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
