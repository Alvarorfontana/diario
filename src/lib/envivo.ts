// Coberturas en vivo (minuto a minuto) de cualquier tema: elecciones, un dato del Indec, un paro.
// Se cargan desde el panel (/admin/coberturas) y se guardan en el repo de datos, como el resto de
// lo que cambia seguido: no disparan un despliegue del sitio y se ven al instante.
import { readData, writeData } from './datastore';
import { slugify } from '../consts';

export const DATA_PATH = 'data/coberturas-en-vivo.json';
export const TZ = 'America/Argentina/Buenos_Aires';
// La portada muestra el recuadro "En vivo" si hubo una entrada en las últimas 6 horas.
export const VENTANA_PORTADA_MS = 6 * 60 * 60 * 1000;

export type Entrada = {
	id: string;
	fecha: string;
	hora: string;
	titulo: string;
	texto: string;
	fuente: string;
	clave: boolean;
	createdAt: string;
};

export type Cobertura = {
	id: string;
	titulo: string;
	bajada: string;
	seccion: string;
	estado: 'activa' | 'cerrada';
	creada: string;
	cerrada?: string;
	entradas: Entrada[];
};

type Env = Record<string, string | undefined>;

// Hora y fecha de Argentina, aunque el servidor de Vercel corra en UTC.
export function horaAR(d = new Date()): string {
	return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
}
export function fechaAR(d = new Date()): string {
	return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: TZ }).replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

export async function leer(token: string, env?: Env): Promise<{ coberturas: Cobertura[]; sha: string | null }> {
	const f = await readData(DATA_PATH, token, env);
	if (!f.text) return { coberturas: [], sha: f.sha };
	try {
		const j = JSON.parse(f.text);
		return { coberturas: Array.isArray(j?.coberturas) ? j.coberturas : [], sha: f.sha };
	} catch {
		return { coberturas: [], sha: f.sha };
	}
}

export async function guardar(coberturas: Cobertura[], sha: string | null, mensaje: string, token: string, env?: Env) {
	const texto = JSON.stringify({ coberturas }, null, 2) + '\n';
	return writeData(DATA_PATH, texto, sha, mensaje, token, env);
}

// Lee, aplica el cambio y guarda. Si otro editor guardó en el medio (conflicto de GitHub),
// vuelve a leer y reintenta una vez, así no se pisan dos entradas cargadas a la vez.
export async function modificar<T>(token: string, env: Env | undefined, mensaje: string,
	cambio: (coberturas: Cobertura[]) => T): Promise<T> {
	for (let intento = 0; ; intento++) {
		const { coberturas, sha } = await leer(token, env);
		const resultado = cambio(coberturas);
		try {
			await guardar(coberturas, sha, mensaje, token, env);
			return resultado;
		} catch (e: any) {
			if (intento === 0 && /GitHub (409|422)/.test(String(e?.message))) continue;
			throw e;
		}
	}
}

export function nuevoId(titulo: string, existentes: Cobertura[]): string {
	const base = slugify(titulo).slice(0, 60).replace(/-+$/, '') || 'cobertura';
	let id = base;
	for (let n = 2; existentes.some((c) => c.id === id); n++) id = `${base}-${n}`;
	return id;
}

export function ultimaEntrada(c: Cobertura): Entrada | undefined {
	return [...c.entradas].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// Versión liviana para listados y para la portada (sin todas las entradas).
export function resumen(c: Cobertura) {
	const u = ultimaEntrada(c);
	return {
		id: c.id, titulo: c.titulo, bajada: c.bajada, seccion: c.seccion, estado: c.estado,
		creada: c.creada, cerrada: c.cerrada, cantidad: c.entradas.length,
		ultima: u ? { titulo: u.titulo, hora: u.hora, fecha: u.fecha, createdAt: u.createdAt } : null,
	};
}
