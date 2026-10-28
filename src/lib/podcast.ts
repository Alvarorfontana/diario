// Podcast "EL DIARIO · Las notas, en voz".
// Cada nota que tiene audio (data/audios.json, lo genera scripts/generar-audios.py)
// es un episodio. Lo usan /podcast.xml (Spotify, Apple, etc.) y la página /escuchar/.
import audios from '../../data/audios.json';
import { getArticulos, type Articulo } from './articles';

export const PODCAST = {
	titulo: 'EL DIARIO · Las notas, en voz',
	descripcion:
		'Las notas de EL DIARIO (diariofederal.com.ar) para escuchar: política, economía e internacional desde una mirada nacional y federal. Cada episodio es una nota leída con voz generada automáticamente.',
	autor: 'EL DIARIO',
	// Spotify y Apple mandan acá el código para confirmar que el podcast es tuyo.
	email: 'contacto@diariofederal.com.ar',
	portada: '/podcast/portada.jpg',
	idioma: 'es-AR',
	categoria: 'News',
	subcategoria: 'Politics',
};

export interface Episodio {
	articulo: Articulo;
	archivo: string;
	duracion: number;
}

type Audio = { archivo: string; duracion: number };

export async function getEpisodios(): Promise<Episodio[]> {
	const mapa = audios as Record<string, Audio>;
	const articulos = await getArticulos();
	return articulos
		.filter((a) => mapa[a.slug]?.archivo)
		.map((a) => ({ articulo: a, archivo: mapa[a.slug].archivo, duracion: mapa[a.slug].duracion || 0 }));
}

export const hhmmss = (s: number) => {
	const t = Math.max(0, Math.round(s));
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const ss = String(t % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
