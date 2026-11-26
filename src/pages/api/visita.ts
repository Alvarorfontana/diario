export const prerender = false;
import { sumarVisita, sumarPaginaDetalle, sumarLectura } from '../../lib/visitas';
import { esRobot, origen, dispositivo, sistema, navegador, lugar, seccionDeRuta, normalizarRuta, horaArgentina, diaSemana, idioma } from '../../lib/visitasClasificar';

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
		if (esRobot(ua)) return new Response(JSON.stringify({ ok: false }), { headers: { 'content-type': 'application/json' } });
		const ruta = normalizarRuta(String(body.ruta ?? '/'));
		const host = new URL(request.url).hostname;
		const geo = lugar(request.headers);
		const campos: Record<string, string> = {
			pagina: ruta,
			seccion: seccionDeRuta(ruta),
			origen: origen(String(body.ref ?? ''), String(body.utm ?? ''), ua, host),
			dispositivo: dispositivo(ua),
			sistema: sistema(ua),
			navegador: navegador(ua),
			pais: geo.pais,
			provincia: geo.provincia,
			ciudad: geo.ciudad,
			hora: horaArgentina(),
			diasemana: diaSemana(),
			idioma: idioma(request.headers),
			lector: body.nuevo === true ? 'Primera vez' : 'Vuelve',
		};
		const tema = String(body.tema ?? '').trim();
		if (tema) campos.tema = tema;
		const ok = await sumarPaginaDetalle(visitante, campos, locals);
		return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
	}
	// Tiempo de lectura y hasta dónde bajó el lector (se manda al salir de la página).
	if (body.lectura === true) {
		const ua = request.headers.get('user-agent') || '';
		const seg = Math.min(1800, Math.max(0, Number(body.segundos) || 0));
		const scroll = Math.min(100, Math.max(0, Number(body.scroll) || 0));
		if (esRobot(ua) || seg < 1) return new Response(JSON.stringify({ ok: false }), { headers: { 'content-type': 'application/json' } });
		const ok = await sumarLectura(normalizarRuta(String(body.ruta ?? '/')), seg, scroll, locals);
		return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
	}
	const slug = String(body.slug ?? '');
	if (!/^[a-z0-9._-]{1,160}$/i.test(slug)) {
		return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'content-type': 'application/json' } });
	}
	const ok = await sumarVisita(slug, locals);
	return new Response(JSON.stringify({ ok }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
