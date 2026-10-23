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
export interface Senal {
	nombre: string;
	descripcion: string;
	listaYoutube: string; // lista de últimos videos del canal ("UU" + el código del canal sin "UC")
	enlace: string;
}

export const SENALES: Senal[] = [
	{
		nombre: 'DW Español',
		descripcion: 'Últimos videos de Deutsche Welle en castellano',
		listaYoutube: 'UUT4Jg8h03dD0iN3Pb5L0PMA',
		enlace: 'https://www.youtube.com/@dwespanol',
	},
];
