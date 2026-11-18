export const prerender = false;
import { sumarVisita, sumarPagina } from '../../lib/visitas';

// Suma una visita a una nota. La llama la página de la nota desde el navegador del lector
// (así no cuentan los robots que no ejecutan JavaScript).
export const POST = async ({ request, locals }: { request: Request; locals?: unknown }) => {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	// Página vista (cualquier página pública): solo para el contador privado del panel.
	if (body.pagina === true) {
		const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
		const ua = request.headers.get('user-agent') || '';
		const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('df-visitante:' + new Date().toISOString().slice(0, 10) + ip + ua));
		const visitante = Array.from(new Uint8Array(buf).slice(0, 12)).map((b) => b.toString(16).padStart(2, '0')).join('');
		const ok = await sumarPagina(visitante, locals);
		return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
	}
	const slug = String(body.slug ?? '');
	if (!/^[a-z0-9._-]{1,160}$/i.test(slug)) {
		return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'content-type': 'application/json' } });
	}
	const ok = await sumarVisita(slug, locals);
	return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
