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

	// Fotos medianas o grandes (desde 600 px de ancho): ocupan toda la vista previa.
	// Antes, las de menos de 1200 px quedaban chicas sobre un fondo difuminado, y en WhatsApp
	// la nota se veía borrosa. Ampliar un poco una foto mediana se ve mucho mejor que ese marco.
	if (w >= 600 || w >= OG_WIDTH || h >= OG_HEIGHT) {
		return sharp(entrada, { failOn: 'none' })
			.rotate()
			.resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention', kernel: 'lanczos3' })
			.sharpen({ sigma: 0.6 })
			.jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:2:0' })
			.toBuffer();
	}

	// Foto muy chica: centrada sobre un fondo liso oscuro (sin difuminar).
	const fondo = await sharp({ create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 3, background: '#16161a' } })
		.jpeg({ quality: 90 })
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

// Foto subida desde el panel: máximo 1600 px de ancho, JPG de buena calidad.
// Devuelve null si no conviene tocarla (GIF animado, SVG) o si sharp no puede leerla:
// en ese caso se guarda el archivo original, como antes.
export async function optimizarSubida(entrada: Uint8Array, tipo: string): Promise<Uint8Array | null> {
	if (!/^image\/(jpe?g|png|webp|avif|heic|heif)$/i.test(tipo)) return null;
	try {
		const salida = await sharp(Buffer.from(entrada), { failOn: 'none' })
			.rotate()
			.resize(1600, null, { withoutEnlargement: true })
			.flatten({ background: '#ffffff' })
			.jpeg({ quality: 82, mozjpeg: true, progressive: true })
			.toBuffer();
		return new Uint8Array(salida);
	} catch {
		return null;
	}
}
