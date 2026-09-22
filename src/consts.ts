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

// URL de suscripción al newsletter (Buttondown). Crea una cuenta gratis en
// https://buttondown.email y sustituye TU-USUARIO por tu nombre de usuario.
export const NEWSLETTER_ACTION = 'https://buttondown.email/api/emails/embed-subscribe/fontana_l';
