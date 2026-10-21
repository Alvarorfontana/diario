// Cartel de la portada para WhatsApp y redes (1200x630): un mosaico con las fotos de las
// últimas notas, oscurecido, con la tarjeta de la marca encima. Se arma solo con las notas del
// momento; la portada pide una versión nueva cada día (?d=AAAA-MM-DD) para que WhatsApp la renueve.
// Si algo falla, se sirve el cartel fijo /images/diario-federal-portada.jpg.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getArticulos } from '../../lib/articles';
import { descargarImagen } from '../../lib/imagenes';

export const prerender = false;

const W = 1200;
const H = 630;
const CW = W / 3;
const CH = H / 2;

export const GET: APIRoute = async ({ url }) => {
	try {
		const articulos = await getArticulos();
		const fuentes = articulos
			.filter((a) => a.image_url)
			.slice(0, 12)
			.map((a) => (/^https?:\/\//i.test(a.image_url) ? a.image_url : new URL(a.image_url, url.origin).href));

		// Bajamos fotos hasta juntar 6 que se puedan usar.
		const celdas: Buffer[] = [];
		for (const src of fuentes) {
			if (celdas.length >= 6) break;
			const bytes = await descargarImagen(src, 5000);
			if (!bytes) continue;
			try {
				celdas.push(await sharp(bytes, { failOn: 'none' }).rotate().resize(CW, CH, { fit: 'cover', position: 'attention' }).toBuffer());
			} catch {}
		}
		if (celdas.length < 6) throw new Error('faltan fotos');

		const tarjeta = await descargarImagen(new URL('/images/marca-tarjeta.png', url.origin).href);
		if (!tarjeta) throw new Error('sin tarjeta');

		// Oscurecido de arriba hacia abajo para que la marca se lea siempre.
		const velo = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16161a" stop-opacity="0.47"/><stop offset="1" stop-color="#16161a" stop-opacity="0.9"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
		);

		const jpeg = await sharp({ create: { width: W, height: H, channels: 3, background: '#16161a' } })
			.composite([
				...celdas.map((input, i) => ({ input, left: (i % 3) * CW, top: Math.floor(i / 3) * CH })),
				{ input: velo, left: 0, top: 0 },
				{ input: tarjeta, left: 70, top: 170 },
			])
			.jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:2:0' })
			.toBuffer();

		return new Response(jpeg, {
			headers: {
				'Content-Type': 'image/jpeg',
				'Cache-Control': 'public, max-age=3600',
				'CDN-Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
			},
		});
	} catch {
		return Response.redirect(new URL('/images/diario-federal-portada.jpg', url.origin), 302);
	}
};
