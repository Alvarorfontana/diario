// Imagen de vista previa (Open Graph) propia, siempre 1200x630.
//
// Por qué existe: WhatsApp/Facebook no muestran bien las fotos externas
// (bloqueos de hotlink, versiones reducidas) y el optimizador de Vercel no
// recorta. Acá descargamos la foto de la nota (esté en nuestro dominio o en
// otro), la recortamos con sharp a 1200x630 y la servimos desde nuestro dominio.
//
// Uso: /api/og/<slug>.jpg?v=<hash>  (el ?v cambia cuando cambia la foto).
export const prerender = false;

import type { APIRoute } from 'astro';
import { getArticulo } from '../../../lib/articles';
import { OG_WIDTH, OG_HEIGHT } from '../../../lib/og';
import { descargarImagen, portadaMarca, recortarPortada } from '../../../lib/imagenes';

export const GET: APIRoute = async ({ params, url, request }) => {
	const slug = String(params.slug || '').replace(/\.(jpe?g|png|webp|avif)$/i, '');
	if (!slug) return new Response('Falta el slug', { status: 400 });

	const articulo = await getArticulo(slug);
	if (!articulo) return new Response('No encontrado', { status: 404 });

	// Resolvemos la foto: externa (http) tal cual; propia (/uploads, /media) contra nuestro dominio.
	let fuente: string | null = null;
	if (articulo.image_url) {
		fuente = /^https?:\/\//i.test(articulo.image_url)
			? articulo.image_url
			: new URL(articulo.image_url, url.origin).href;
	}

	const bytes = (fuente ? await descargarImagen(fuente) : null) ?? portadaMarca();

	let salida: Buffer;
	try {
		salida = await recortarPortada(bytes);
	} catch {
		salida = await recortarPortada(portadaMarca());
	}

	// La versión en la URL ya identifica la foto; se puede cachear para siempre.
	const etag = `"og-${OG_WIDTH}x${OG_HEIGHT}-${articulo.image_url ? encodeURIComponent(articulo.image_url).slice(0, 40) : 'marca'}"`;
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
