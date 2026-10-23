// Datos globales del sitio. Edita estos valores para personalizar tu diario.

export const SITE_TITLE = 'EL DIARIO';
export const SITE_DESCRIPTION = 'Actualidad, análisis y opinión.';

export const ADMIN_CREDENTIALS = {
	email: 'admin@eldiario.local',
	password: 'admin123',
} as const;

// Secciones del periódico. `id` se usa en las URLs (/seccion/<id>/).
export const SECCIONES = [
	{ id: 'internacional', nombre: 'Internacional' },
	{ id: 'argentina', nombre: 'Argentina' },
	{ id: 'economia', nombre: 'Economía' },
	{ id: 'deportes', nombre: 'Deportes' },
	{ id: 'cultura', nombre: 'Cultura' },
	{ id: 'tecnologia', nombre: 'Tecnología' },
	{ id: 'opinion', nombre: 'Opinión' },
] as const;

export type SeccionId = (typeof SECCIONES)[number]['id'];

// Identificador de tu sitio en Disqus (https://disqus.com/admin/create/).
// Déjalo vacío ('') para ocultar los comentarios hasta que lo configures.
export const DISQUS_SHORTNAME = '';

// Enlaces de redes sociales (muestra iconos en la cabecera). Sustituye por tus perfiles.
export const SOCIAL_LINKS = [
	{ nombre: 'X (Twitter)', url: '#', icono: 'x' },
	{ nombre: 'Facebook', url: '#', icono: 'facebook' },
	{ nombre: 'Instagram', url: '#', icono: 'instagram' },
	{ nombre: 'YouTube', url: '#', icono: 'youtube' },
] as const;

export function nombreSeccion(id: string): string {
	return SECCIONES.find((s) => s.id === id)?.nombre ?? id;
}

// Convierte texto a slug para URLs de etiquetas (sin acentos ni espacios)
export function slugify(texto: string): string {
	return texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// Google Analytics 4 (gratis). Pegá acá el ID de medición que empieza con "G-"
// (analytics.google.com → Administrar → Flujos de datos). Vacío = desactivado.
export const GA_ID = '';

// El newsletter se integra con Brevo (ver src/lib/brevo.ts y NEWSLETTER.md).

// Fotos de los columnistas para la sección Opinión de la portada.
// Agregá una línea por autor con el nombre tal cual figura en la nota y la ruta de la foto
// (por ejemplo, subida a /public/columnistas/). Si un autor no tiene foto, se muestran sus iniciales.
export const FOTOS_COLUMNISTAS: Record<string, string> = {
	// 'Álvaro Fontana': '/columnistas/alvaro-fontana.jpg',
};

// Ficha de cada autor para su página (/autor/<nombre>/). Agregá una línea por autor con el nombre
// tal cual figura en las notas. Todo es opcional: sin bio ni foto, la página muestra las iniciales.
export const AUTORES: Record<string, { bio?: string; foto?: string }> = {
	// 'Álvaro Fontana': { bio: 'Periodista y especialista en políticas públicas.', foto: '/columnistas/alvaro-fontana.jpg' },
};

export function fotoAutor(nombre: string): string | undefined {
	return AUTORES[nombre]?.foto ?? FOTOS_COLUMNISTAS[nombre];
}
