// Regiones del país para la portada regional (estilo Letra P).
// Cada nota puede tener su región elegida en el panel. Si no la tiene,
// se deduce sola buscando provincias, ciudades y gobernadores en el título,
// la bajada, la volanta y las etiquetas.

export const REGIONES = [
	{ id: 'norte-grande', nombre: 'Norte Grande', descripcion: 'NEA y NOA' },
	{ id: 'centro', nombre: 'Centro', descripcion: 'Córdoba, Santa Fe y Entre Ríos' },
	{ id: 'cuyo', nombre: 'Cuyo', descripcion: 'Mendoza, San Juan y San Luis' },
	{ id: 'patagonia', nombre: 'Patagonia', descripcion: 'De La Pampa a Tierra del Fuego' },
	{ id: 'buenos-aires', nombre: 'Buenos Aires', descripcion: 'Provincia y Ciudad' },
] as const;

export type RegionId = (typeof REGIONES)[number]['id'];

export function nombreRegion(id: string): string {
	return REGIONES.find((r) => r.id === id)?.nombre ?? id;
}

// Palabras clave en mayúscula inicial y SIN acentos: se comparan respetando mayúsculas
// para no confundir "Salta" (provincia) con "salta" (verbo) o "Misiones" con "misiones".
const CLAVES: Record<RegionId, string[]> = {
	'norte-grande': [
		'Corrientes', 'Misiones', 'Chaco', 'Formosa', 'Jujuy', 'Salta', 'Tucuman', 'Catamarca',
		'Santiago del Estero', 'La Rioja', 'Posadas', 'Resistencia', 'Goya', 'Iguazu', 'NEA', 'NOA',
		'Norte Grande', 'Jaldo', 'Saenz', 'Valdes', 'Zdero', 'Passalacqua', 'Insfran', 'Sadir', 'Jalil',
		'Quintela', 'Manzur', 'correntin', 'chaquen', 'misioner', 'tucuman', 'salten', 'jujen', 'formosen',
	],
	centro: [
		'Cordoba', 'Santa Fe', 'Entre Rios', 'Rosario', 'Llaryora', 'Pullaro', 'Frigerio',
		'cordobes', 'santafesin', 'entrerrian', 'rosarin',
	],
	cuyo: ['Mendoza', 'San Juan', 'San Luis', 'Cornejo', 'Orrego', 'Poggi', 'mendocin', 'sanjuanin', 'puntan', 'Cuyo'],
	patagonia: [
		'Neuquen', 'Rio Negro', 'Chubut', 'Santa Cruz', 'Tierra del Fuego', 'La Pampa', 'Bariloche',
		'Ushuaia', 'Comodoro Rivadavia', 'Figueroa', 'Weretilneck',
		'Melella', 'Ziliotto', 'Patagonia', 'patagonic', 'neuquin', 'fueguin', 'chubutens', 'rionegrin',
	],
	'buenos-aires': [
		'Provincia de Buenos Aires', 'provincia de Buenos Aires', 'bonaerense', 'Conurbano', 'conurbano',
		'La Plata', 'Mar del Plata', 'Bahia Blanca', 'Legislatura portena', 'porten', 'Jorge Macri', 'CABA',
		'Ciudad de Buenos Aires', 'La Matanza', 'Quilmes', 'Lomas de Zamora',
	],
};

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Las claves en minúscula son raíces de gentilicios ("correntin" → correntino/a);
// las que empiezan en mayúscula son nombres propios completos.
const PATRONES = Object.fromEntries(
	Object.entries(CLAVES).map(([region, claves]) => [
		region,
		claves.map((c) => (/^[a-z]/.test(c) ? new RegExp(`\\b${c}\\w*`, 'g') : new RegExp(`\\b${c}\\b`, 'g'))),
	]),
) as Record<RegionId, RegExp[]>;

/** Deduce la región de una nota. Devuelve undefined si es nacional o no hay pistas claras. */
export function deducirRegion(texto: string): RegionId | undefined {
	const t = sinAcentos(texto);
	let mejor: RegionId | undefined;
	let maxPuntos = 0;
	let empate = false;
	for (const r of REGIONES) {
		let puntos = 0;
		for (const p of PATRONES[r.id]) puntos += (t.match(p) ?? []).length;
		if (puntos > maxPuntos) {
			maxPuntos = puntos;
			mejor = r.id;
			empate = false;
		} else if (puntos > 0 && puntos === maxPuntos) empate = true;
	}
	// Si dos regiones empatan, la nota es nacional.
	return maxPuntos > 0 && !empate ? mejor : undefined;
}
