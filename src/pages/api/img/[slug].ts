// Foto que se ve dentro de la nota, servida desde nuestro dominio.
//
// La nota guarda la dirección original (a veces de otro sitio). Acá la bajamos,
// la redimensionamos con sharp y la servimos nosotros: el navegador del lector
// no vuelve a depender del servidor de origen.
//
// Uso: /api/img/<slug>.jpg?w=<ancho>&v=<hash>  (el ?v cambia cuando cambia la foto).
export const prerender = false;

import type { APIRoute } from 'astro';
import { getArticulo } from '../../../lib/articles';
import { descargarImagen, redimensionarAncho } from '../../../lib/imagenes';

// Anchuras permitidas (evita que se use el endpoint para generar tamaños arbitrarios).
const ANCHOS = [480, 640, 828, 1080, 1200, 1600];

export const GET: APIRoute = async ({ params, url, request }) => {
	const slug = String(params.slug || '').replace(/\.(jpe?g|png|webp|avif)$/i, '');
	if (!slug) return new Response('Falta el slug', { status: 400 });

	const articulo = await getArticulo(slug);
	if (!articulo || !articulo.image_url) return new Response('No encontrado', { status: 404 });

	const pedido = Number(url.searchParams.get('w'));
	const ancho = ANCHOS.includes(pedido) ? pedido : 1200;

	const fuente = /^https?:\/\//i.test(articulo.image_url)
		? articulo.image_url
		: new URL(articulo.image_url, url.origin).href;

	const bytes = await descargarImagen(fuente);
	if (!bytes) return new Response('No disponible', { status: 404 });

	let salida: Buffer;
	try {
		salida = await redimensionarAncho(bytes, ancho);
	} catch {
		return new Response('No disponible', { status: 404 });
	}

	const etag = `"img-${ancho}-${encodeURIComponent(articulo.image_url).slice(0, 40)}"`;
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}

	return new Response(salida, {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'CDN-Cache-Control': 'public, max-age=31536000, immutable',
			'ETag': etag,
		},
	});
};
