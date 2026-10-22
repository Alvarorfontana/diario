// Comentarios de los lectores: se guardan en data/comments.json (repo de datos).
// Los nuevos quedan "pendiente" hasta que la redacción los aprueba desde el
// panel (/admin/comentarios) o desde el mail de aviso.
import { readData, writeData } from './datastore';

export const ARCHIVO_COMENTARIOS = 'data/comments.json';

export type EstadoComentario = 'pendiente' | 'aprobado';

export interface Comentario {
	id: string;
	articleId: string;
	author: string;
	text: string;
	date: string;
	// Los comentarios viejos no tienen estado: ya estaban publicados, cuentan como aprobados
	estado?: EstadoComentario;
}

export const estadoDe = (c: Comentario): EstadoComentario => c.estado ?? 'aprobado';

export async function leerComentarios(token: string): Promise<{ comentarios: Comentario[]; sha: string | null }> {
	const { text, sha } = await readData(ARCHIVO_COMENTARIOS, token);
	if (!text) return { comentarios: [], sha };
	try {
		const datos = JSON.parse(text);
		return { comentarios: Array.isArray(datos) ? datos : [], sha };
	} catch {
		return { comentarios: [], sha };
	}
}

/**
 * Lee, aplica un cambio y guarda. Si otro cambio se cruzó al mismo tiempo
 * (GitHub responde 409), vuelve a leer y reintenta.
 */
export async function modificarComentarios<T>(
	token: string,
	mensaje: string,
	cambio: (lista: Comentario[]) => T,
): Promise<T> {
	let ultimoError: unknown;
	for (let intento = 0; intento < 3; intento++) {
		const { comentarios, sha } = await leerComentarios(token);
		const resultado = cambio(comentarios);
		try {
			await writeData(ARCHIVO_COMENTARIOS, JSON.stringify(comentarios, null, 2), sha, mensaje, token);
			return resultado;
		} catch (e: any) {
			ultimoError = e;
			if (!/GitHub (409|422)/.test(String(e?.message))) throw e;
		}
	}
	throw ultimoError;
}

/** Aprueba o borra un comentario. Devuelve el comentario afectado (o null si no existe). */
export async function moderar(token: string, id: string, accion: 'aprobar' | 'borrar'): Promise<Comentario | null> {
	return modificarComentarios(token, accion === 'aprobar' ? 'Aprobar comentario' : 'Borrar comentario', (lista) => {
		const i = lista.findIndex((c) => c.id === id);
		if (i === -1) return null;
		const c = lista[i];
		if (accion === 'aprobar') c.estado = 'aprobado';
		else lista.splice(i, 1);
		return c;
	});
}

// ── Links firmados para aprobar o borrar desde el mail ───────────────────────
// La firma usa la contraseña del panel como clave: sin ella no se puede armar un link válido.

async function hmac(clave: string, texto: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(texto));
	return Array.from(new Uint8Array(firma)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export function firmarModeracion(clave: string, id: string, accion: string): Promise<string> {
	return hmac(`moderar-comentarios:${clave}`, `${id}:${accion}`);
}

export async function firmaValida(clave: string | undefined, id: string, accion: string, firma: string): Promise<boolean> {
	if (!clave || !id || !firma) return false;
	const esperada = await firmarModeracion(clave, id, accion);
	if (esperada.length !== firma.length) return false;
	let dif = 0;
	for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
	return dif === 0;
}

export async function linkModeracion(origen: string, clave: string, id: string, accion: 'aprobar' | 'borrar'): Promise<string> {
	const firma = await firmarModeracion(clave, id, accion);
	const q = new URLSearchParams({ id, accion, firma });
	return `${origen}/comentarios/moderar/?${q}`;
}

export function escaparHtml(t: string): string {
	return String(t ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
