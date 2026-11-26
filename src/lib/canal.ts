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
// borrá o agregá señales. Alcanza con el @ del canal ("usuario"): el sitio averigua solo
// si está transmitiendo en vivo (/api/senal-vivo). Si no hay vivo, muestra sus últimos videos.
// El código del canal ("canal", empieza con "UC") es opcional: si está, la lista de últimos
// videos aparece al instante, sin esperar.
export const REGIONES = [
	'Argentina',
	'Uruguay y Paraguay',
	'América Latina',
	'Estados Unidos',
	'España y Europa',
	'Brasil (en portugués)',
	'Medio Oriente y Asia',
] as const;
export type Region = (typeof REGIONES)[number];

export interface Senal {
	nombre: string;
	descripcion: string;
	usuario: string; // el @ del canal de YouTube, sin la arroba
	region: Region;
	origen: string; // país o quién está detrás, para que el lector sepa quién habla
	canal?: string; // código del canal de YouTube (empieza con "UC"), opcional
}

export const SENALES: Senal[] = [
	// España y Europa (DW sigue primera: es la que se ve al entrar)
	{ nombre: 'DW Español', descripcion: 'Deutsche Welle en castellano', canal: 'UCT4Jg8h03dD0iN3Pb5L0PMA', usuario: 'dwespanol', region: 'España y Europa', origen: 'Alemania · medio público' },
	{ nombre: 'France 24 Español', descripcion: 'Noticias internacionales desde París', canal: 'UCUdOoVWuWmgo1wByzcsyKDQ', usuario: 'France24_es', region: 'España y Europa', origen: 'Francia · medio público' },
	{ nombre: 'Euronews en español', descripcion: 'Europa y el mundo, al minuto', canal: 'UCyoGb3SMlTlB8CLGVH4c8Rw', usuario: 'euronewses', region: 'España y Europa', origen: 'Unión Europea' },
	{ nombre: 'RTVE Noticias', descripcion: 'Canal 24 horas de la televisión pública española', usuario: 'rtvenoticias', region: 'España y Europa', origen: 'España · medio público' },

	// Argentina
	{ nombre: 'C5N', descripcion: 'Noticias de Argentina, en vivo', canal: 'UCFgk2Q2mVO1BklRQhSv6p0w', usuario: 'c5n', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'TN', descripcion: 'Todo Noticias', usuario: 'todonoticias', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'A24', descripcion: 'Noticias y actualidad', usuario: 'A24com', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'LN+', descripcion: 'La señal de La Nación', usuario: 'lanacion', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'Crónica TV', descripcion: 'Noticias las 24 horas', usuario: 'cronicatv', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'Canal 26', descripcion: 'Noticias las 24 horas', usuario: 'canal26', region: 'Argentina', origen: 'Argentina' },
	{ nombre: 'Página/12', descripcion: 'Entrevistas y análisis de Página/12', canal: 'UCJNDedOnljCssaiRZqg8-Dg', usuario: 'pagina12', region: 'Argentina', origen: 'Argentina' },

	// Uruguay y Paraguay
	{ nombre: 'Canal 5 Uruguay', descripcion: 'Televisión pública uruguaya', usuario: 'canal5uy', region: 'Uruguay y Paraguay', origen: 'Uruguay · medio público' },
	{ nombre: 'ABC TV Paraguay', descripcion: 'El canal de ABC Color', canal: 'UCEklbFbPoMaV1ciEb-0mAxg', usuario: 'abcparaguay', region: 'Uruguay y Paraguay', origen: 'Paraguay' },

	// América Latina
	{ nombre: 'N+ Foro', descripcion: 'Noticias de México, de Televisa', usuario: 'nmas', region: 'América Latina', origen: 'México' },
	{ nombre: 'Milenio', descripcion: 'Noticias de México', usuario: 'MILENIO', region: 'América Latina', origen: 'México' },
	{ nombre: 'CNN Chile', descripcion: 'Noticias de Chile', usuario: 'CNNChile', region: 'América Latina', origen: 'Chile' },
	{ nombre: 'Noticias Caracol', descripcion: 'Noticias de Colombia', usuario: 'NoticiasCaracol', region: 'América Latina', origen: 'Colombia' },
	{ nombre: 'NTN24', descripcion: 'Noticias de las Américas', usuario: 'NTN24', region: 'América Latina', origen: 'Colombia' },

	// Estados Unidos
	{ nombre: 'CNN en Español', descripcion: 'Noticias de Estados Unidos y el mundo', usuario: 'cnnee', region: 'Estados Unidos', origen: 'Estados Unidos' },

	// Brasil (en portugués)
	{ nombre: 'CNN Brasil', descripcion: 'Notícias do Brasil e do mundo', usuario: 'CNNbrasil', region: 'Brasil (en portugués)', origen: 'Brasil · en portugués' },
	{ nombre: 'SBT News', descripcion: 'Notícias 24 horas', usuario: 'SBTNews', region: 'Brasil (en portugués)', origen: 'Brasil · en portugués' },
	{ nombre: 'Jovem Pan News', descripcion: 'Notícias e debates', usuario: 'jovempannews', region: 'Brasil (en portugués)', origen: 'Brasil · en portugués' },

	// Medio Oriente y Asia
	{ nombre: 'TRT Español', descripcion: 'La televisión pública de Turquía, en castellano', usuario: 'TRTEspanol', region: 'Medio Oriente y Asia', origen: 'Turquía · medio estatal' },
	{ nombre: 'CGTN Español', descripcion: 'La televisión internacional de China, en castellano', usuario: 'CGTNEspanol', region: 'Medio Oriente y Asia', origen: 'China · medio estatal' },
];

export const listaUltimos = (canal: string) => 'UU' + canal.slice(2);
export const USUARIOS_SENALES = new Set(SENALES.map((s) => s.usuario.toLowerCase()));
