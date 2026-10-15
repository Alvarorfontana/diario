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
import sharp from 'sharp';
import { getArticulo } from '../../../lib/articles';
import { SITE_TITLE } from '../../../consts';
import { OG_WIDTH, OG_HEIGHT } from '../../../lib/og';

const UA = 'Mozilla/5.0 (compatible; ELDIARIO-OG/1.0; +https://www.diariofederal.com.ar)';

async function descargar(url: string): Promise<Buffer | null> {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, Accept: 'image/*' },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return null;
		const tipo = res.headers.get('content-type') || '';
		if (!tipo.startsWith('image/')) return null;
		return Buffer.from(await res.arrayBuffer());
	} catch {
		return null;
	}
}

// Portada de respaldo (marca) cuando la nota no tiene foto o la descarga falla.
function portadaMarca(): Buffer {
	const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
	<rect width="100%" height="100%" fill="#e93323"/>
	<text x="50%" y="50%" font-family="Georgia, 'Times New Roman', serif" font-size="86"
		font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${SITE_TITLE}</text>
</svg>`;
	return Buffer.from(svg);
}

// Recorta a 1200x630 sin ampliar fotos chicas (evita el efecto borroso):
// si la foto no alcanza, se centra sobre un fondo difuminado de la misma foto.
async function a1200x630(entrada: Buffer): Promise<Buffer> {
	const meta = await sharp(entrada, { failOn: 'none' }).rotate().metadata();
	const w = meta.width ?? 0;
	const h = meta.height ?? 0;
	if (!w || !h) throw new Error('sin dimensiones');

	const alcanza = w >= OG_WIDTH || h >= OG_HEIGHT;
	if (alcanza) {
		return sharp(entrada, { failOn: 'none' })
			.rotate()
			.resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
			.jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: '4:2:0' })
			.toBuffer();
	}

	// Foto más chica que la portada: fondo difuminado (cover) + foto centrada (contain).
	const fondo = await sharp(entrada, { failOn: 'none' })
		.rotate()
		.resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
		.blur(40)
		.modulate({ brightness: 0.85 })
		.jpeg({ quality: 70 })
		.toBuffer();
	const foto = await sharp(entrada, { failOn: 'none' })
		.rotate()
		.resize(OG_WIDTH, OG_HEIGHT, { fit: 'inside', withoutEnlargement: true })
		.toBuffer();
	return sharp(fondo)
		.composite([{ input: foto, gravity: 'center' }])
		.jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: '4:2:0' })
		.toBuffer();
}

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

	const bytes = (fuente ? await descargar(fuente) : null) ?? portadaMarca();

	let salida: Buffer;
	try {
		salida = await a1200x630(bytes);
	} catch {
		salida = await a1200x630(portadaMarca());
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
