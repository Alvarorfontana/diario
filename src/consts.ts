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

export const DISQUS_SHORTNAME = '';

export const SOCIAL_LINKS = [
	{ nombre: 'X (Twitter)', url: '#', icono: 'x' },
	{ nombre: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61595974264717', icono: 'facebook' },
	{ nombre: 'Instagram', url: '#', icono: 'instagram' },
	{ nombre: 'YouTube', url: '#', icono: 'youtube' },
	{ nombre: 'Canal de WhatsApp', url: '#', icono: 'whatsapp' },
] as const;

export function volantaFuerte(volanta?: string): boolean {
	return !!volanta && /^(exclusivo|urgente|último momento|ultimo momento|primicia)$/i.test(volanta.trim());
}

export function nombreSeccion(id: string): string {
	return SECCIONES.find((s) => s.id === id)?.nombre ?? id;
}

export function slugify(texto: string): string {
	return texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export const GA_ID = '';

export const FOTOS_COLUMNISTAS: Record<string, string> = {
	'Carlos Mendes': '/columnistas/carlos-mendes.jpg',
};

export const AUTORES: Record<string, { bio?: string; foto?: string }> = {
	'Ulises Gastón González': {
		foto: '/autores/ulises-gaston-gonzalez.jpg',
	},
	'Emilio Lahitte': {
		foto: '/autores/emilio-lahitte.jpg',
	},
	'Carlos Mendes': {
		bio: 'Periodista.',
		foto: '/columnistas/carlos-mendes.jpg',
	},
	'Alberto González': {
		bio: 'Autor de ejemplo · Información internacional y política estadounidense.',
		foto: 'https://i.pravatar.cc/160?img=12',
	},
};

export function fotoAutor(nombre: string): string | undefined {
	return AUTORES[nombre]?.foto ?? FOTOS_COLUMNISTAS[nombre];
}
