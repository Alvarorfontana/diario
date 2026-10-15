// Procesamiento de imágenes con sharp.
//
// Lo comparten los endpoints:
//   - /api/og/<slug>.jpg  → vista previa 1200x630 para redes (WhatsApp, Facebook, X)
//   - /api/img/<slug>.jpg → foto que se ve dentro de la nota, servida por nosotros
//
// Así ninguna de las dos depende del servidor original de la foto (df.cl, gstatic…).
import sharp from 'sharp';
import { SITE_TITLE } from '../consts';
import { OG_WIDTH, OG_HEIGHT } from './og';

const UA = 'Mozilla/5.0 (compatible; ELDIARIO/1.0; +https://www.diariofederal.com.ar)';

// Descarga una imagen (propia o de un tercero). Devuelve null si falla o no es imagen.
export async function descargarImagen(url: string, timeoutMs = 8000): Promise<Buffer | null> {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, Accept: 'image/*' },
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!res.ok) return null;
		if (!(res.headers.get('content-type') || '').startsWith('image/')) return null;
		return Buffer.from(await res.arrayBuffer());
	} catch {
		return null;
	}
}

// Portada de respaldo (marca) cuando la nota no tiene foto o la descarga falla.
export function portadaMarca(): Buffer {
	const svg = `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
	<rect width="100%" height="100%" fill="#e93323"/>
	<text x="50%" y="50%" font-family="Georgia, 'Times New Roman', serif" font-size="86"
		font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${SITE_TITLE}</text>
</svg>`;
	return Buffer.from(svg);
}

// Recorta a 1200x630 sin ampliar fotos chicas (evita el efecto borroso):
// si la foto no alcanza, se centra sobre un fondo difuminado de la misma foto.
export async function recortarPortada(entrada: Buffer): Promise<Buffer> {
	const meta = await sharp(entrada, { failOn: 'none' }).rotate().metadata();
	const w = meta.width ?? 0;
	const h = meta.height ?? 0;
	if (!w || !h) throw new Error('sin dimensiones');

	if (w >= OG_WIDTH || h >= OG_HEIGHT) {
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

// Redimensiona al ancho pedido manteniendo la proporción (foto visible de la nota).
// `withoutEnlargement` evita ampliar fotos que ya son más chicas que ese ancho.
export async function redimensionarAncho(entrada: Buffer, ancho: number): Promise<Buffer> {
	return sharp(entrada, { failOn: 'none' })
		.rotate()
		.resize(ancho, null, { withoutEnlargement: true })
		.jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: '4:2:0' })
		.toBuffer();
}
