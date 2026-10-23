// Canal de noticias de EL DIARIO.
// Los videos se suben gratis a YouTube y acá se pega el código de cada uno
// (lo que va después de "v=" en el enlace, o después de "/shorts/" en los clips).
// El primero de la lista es el video principal.

export interface VideoCanal {
	id: string; // código de YouTube, por ejemplo "dQw4w9WgXcQ"
	titulo: string;
	volanta?: string; // por ejemplo "Análisis en video"
	duracion?: string; // por ejemplo "4:20"
	nota?: string; // slug de la nota relacionada, si hay
}

export const VIDEOS: VideoCanal[] = [];

// Clips cortos verticales (Shorts de YouTube)
export const CLIPS: VideoCanal[] = [];

// Si hay una transmisión en vivo, pegá acá su código; si no, dejalo vacío.
export const VIVO_ID = '';

// Señales de otros medios que se muestran en el Canal, siempre con su nombre.
// Se insertan con el reproductor oficial de YouTube: los videos quedan alojados en su canal.
// Para cambiar según la ocasión: reordená la lista (la primera es la que se ve al entrar),
// borrá o agregá señales. El código del canal empieza con "UC"; la lista de últimos videos
// se arma sola cambiando "UC" por "UU".
export interface Senal {
	nombre: string;
	descripcion: string;
	canal: string; // código del canal de YouTube (empieza con "UC")
	usuario: string; // el @ del canal, para el botón "Ver en vivo"
}

export const SENALES: Senal[] = [
	{ nombre: 'DW Español', descripcion: 'Deutsche Welle en castellano', canal: 'UCT4Jg8h03dD0iN3Pb5L0PMA', usuario: 'dwespanol' },
	{ nombre: 'C5N', descripcion: 'Noticias de Argentina, en vivo', canal: 'UCFgk2Q2mVO1BklRQhSv6p0w', usuario: 'c5n' },
	{ nombre: 'Página/12', descripcion: 'Entrevistas y análisis de Página/12', canal: 'UCJNDedOnljCssaiRZqg8-Dg', usuario: 'pagina12' },
	{ nombre: 'France 24 Español', descripcion: 'Noticias internacionales desde París', canal: 'UCUdOoVWuWmgo1wByzcsyKDQ', usuario: 'France24_es' },
	{ nombre: 'Euronews en español', descripcion: 'Europa y el mundo, al minuto', canal: 'UCyoGb3SMlTlB8CLGVH4c8Rw', usuario: 'euronewses' },
];

export const listaUltimos = (canal: string) => 'UU' + canal.slice(2);
