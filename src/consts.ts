// Datos globales del sitio. Edita estos valores para personalizar tu diario.

export const SITE_TITLE = 'EL DIARIO';
export const SITE_DESCRIPTION =
	'Diario Federal: noticias de Argentina y el mundo desde todas las provincias. Política, economía, energía, internacional y opinión con mirada nacional y federal.';
// Título largo solo para la portada (Google). La marca sigue siendo SITE_TITLE.
export const HOME_TITLE = 'EL DIARIO | Diario Federal: noticias de Argentina, las provincias y el mundo';

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

// Secciones que se muestran en el menú desplegable, el pie y el 404 (pocas, como los portales).
// Deportes, Cultura y Tecnología siguen existiendo para cargar notas, pero sus notas van al montón de la portada.
export const SECCIONES_MENU = SECCIONES.filter((s) => ['internacional', 'argentina', 'economia', 'opinion'].includes(s.id));

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
	'Ramiro De la Puente': {
		foto: '/autores/ramiro-de-la-puente.jpg',
	},
	'Roberto Bonetti': {
		bio: 'Secretario General de la Unión Obrera Metalúrgica Seccional Capital.',
		foto: '/autores/roberto-bonetti.jpg',
	},
	'Carlos Mendes': {
		bio: 'Periodista.',
		foto: '/columnistas/carlos-mendes.jpg',
	},
	'Alberto González': {
		bio: 'Autor de ejemplo · Información internacional y política estadounidense.',
		foto: 'https://i.pravatar.cc/160?img=12',
	},
	'Prof. Dr. Miguel Ángel Barrios': {
		bio: 'Doctor en Ciencia Política, Dr. en Ciencias de la Educación y especialista en Doctrina Social de la Iglesia. Autor de más de 30 obras sobre América Latina.',
		foto: 'https://patriagrande.com/wp-content/uploads/2024/03/Barrios-3.jpeg',
	},
	'Mesa Internacional': {
		bio: 'Equipo de Diario Federal que sigue la política internacional, el Mercosur y la economía global.',
	},
	'Redacción Federal': {
		bio: 'Equipo de Diario Federal que sigue la actualidad de las provincias y la política nacional.',
	},
};

export function fotoAutor(nombre: string): string | undefined {
	return AUTORES[nombre]?.foto ?? FOTOS_COLUMNISTAS[nombre];
}
