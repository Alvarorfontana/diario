// Utilidades para la imagen de vista previa (Open Graph) de cada nota.
//
// El sitio genera su propia imagen de 1200x630 en /api/og/<slug>.jpg, recortada
// con sharp, para que WhatsApp, Facebook, X y Telegram muestren siempre una
// vista nítida y no dependan de servidores de terceros (df.cl, gstatic, etc.).
//
// El optimizador de Vercel (/_vercel/image) NO permite forzar un recorte:
// ignora los parámetros `h` y `fit` y devuelve el tamaño natural de la foto,
// por eso no alcanza con agregar &h=630.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Hash corto y estable. Cambia cuando cambia la foto, así la URL de la imagen
// cambia y se rompe la caché de WhatsApp/Facebook y de la CDN.
export function ogVersion(seed: string): string {
	let h = 5381;
	for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

// Ruta relativa de la imagen de vista previa de una nota.
export function ogImagePath(slug: string, imageUrl?: string | null): string {
	const v = ogVersion(`${slug}|${imageUrl ?? ''}`);
	return `/api/og/${encodeURIComponent(slug)}.jpg?v=${v}`;
}

// Ruta relativa de la foto que se ve dentro de la nota, servida por nosotros.
export function imagenNotaPath(slug: string, imageUrl: string | null | undefined, ancho = 1200): string {
	const v = ogVersion(`${slug}|${imageUrl ?? ''}|${ancho}`);
	return `/api/img/${encodeURIComponent(slug)}.jpg?w=${ancho}&v=${v}`;
}
