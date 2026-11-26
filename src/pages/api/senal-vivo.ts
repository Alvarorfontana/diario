export const prerender = false;

// ¿Está transmitiendo en vivo esta señal del Canal?
// Recibe el @ de un canal de la lista (src/lib/canal.ts) y mira su página pública /live en YouTube.
// No usa clave ni cuota de la API de YouTube. Vercel guarda la respuesta 10 minutos:
// aunque entren muchos lectores, cada señal se consulta como mucho unas 6 veces por hora,
// y no se dispara ningún despliegue.
// Devuelve { vivo: código del video en vivo o null, canal: código UC del canal o null }.

import { USUARIOS_SENALES } from '../../lib/canal';

const ID_VIDEO = /^[\w-]{11}$/;
const ID_CANAL = /(UC[\w-]{22})/;

function json(body: unknown, segundos: number) {
	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': `public, max-age=60, s-maxage=${segundos}, stale-while-revalidate=1800`,
		},
	});
}

export async function GET({ url }: { url: URL }) {
	const usuario = (url.searchParams.get('u') ?? '').trim();
	// Solo señales de la lista del diario: el servidor no consulta direcciones ajenas.
	if (!usuario || !USUARIOS_SENALES.has(usuario.toLowerCase())) {
		return json({ vivo: null, canal: null, error: 'señal desconocida' }, 3600);
	}

	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 6000);
	try {
		const res = await fetch(`https://www.youtube.com/@${encodeURIComponent(usuario)}/live`, {
			signal: ctrl.signal,
			redirect: 'follow',
			headers: {
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
				'accept-language': 'es-AR,es;q=0.9',
				cookie: 'CONSENT=YES+1; SOCS=CAI',
			},
		});
		if (!res.ok) return json({ vivo: null, canal: null }, 600);
		const html = await res.text();

		const canal =
			html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ??
			html.match(/itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/)?.[1] ??
			html.match(/"channelId":"(UC[\w-]{22})"/)?.[1] ??
			html.match(ID_CANAL)?.[1] ??
			null;

		// Cuando hay vivo, /live muestra el video: la dirección canónica es watch?v=… y el
		// reproductor dice isLive. Si es una transmisión programada (todavía no empezó), no cuenta.
		const canonico = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
		const enVivo = Boolean(canonico) && /"isLive(?:Now)?":true/.test(html) && !/"isUpcoming":true/.test(html);
		const vivo = enVivo && canonico && ID_VIDEO.test(canonico) ? canonico : null;

		return json({ vivo, canal }, 600);
	} catch {
		return json({ vivo: null, canal: null }, 300);
	} finally {
		clearTimeout(t);
	}
}
