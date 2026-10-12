// Datos que cambian todo el tiempo (comentarios, suscripciones, publicidad, minuto a minuto, fotos)
// en un repositorio PRIVADO aparte (DATA_REPO), para que:
//   1) no disparen un despliegue de Vercel cada vez que alguien comenta o se suscribe;
//   2) los correos de los suscriptores no queden públicos en el repositorio del sitio.
// Si DATA_REPO no está configurado, todo sigue funcionando como antes (en el repo del sitio).
// Lectura con respaldo: si un archivo todavía no existe en el repo de datos, se lee el viejo del
// repo del sitio; la próxima escritura lo crea en el repo de datos (migración automática).
import { getRepo } from './repo';

const ie: any = import.meta.env;
const pe: any = typeof process !== 'undefined' ? process.env : {};
const pick = (k: string): string | undefined => ie[k] || pe[k] || undefined;

export function getDataRepo(env?: Record<string, string | undefined>): { repo: string; branch: string; separate: boolean } {
	const repo = env?.DATA_REPO || pick('DATA_REPO');
	if (repo) return { repo, branch: env?.DATA_BRANCH || pick('DATA_BRANCH') || 'main', separate: true };
	return { ...getRepo(), separate: false };
}

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const headers = (token: string, extra: Record<string, string> = {}) => ({
	Authorization: `Bearer ${token}`,
	Accept: 'application/vnd.github+json',
	'User-Agent': 'eldiario-datos',
	...extra,
});

export function b64encodeUtf8(text: string): string {
	const bytes = new TextEncoder().encode(text);
	return b64encodeBytes(bytes);
}
export function b64encodeBytes(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}
function b64decodeUtf8(b64: string): string {
	const bin = atob(b64.replace(/\n/g, ''));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function getContents(repo: string, branch: string, path: string, token: string) {
	const res = await fetch(`https://api.github.com/repos/${repo}/contents/${enc(path)}?ref=${branch}`, { headers: headers(token), cache: 'no-store' });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub ${res.status}`);
	return res.json();
}

/** Lee un archivo de texto del repo de datos. `sha` es el del repo de datos (null si todavía no existe ahí). */
export async function readData(path: string, token: string, env?: Record<string, string | undefined>): Promise<{ text: string | null; sha: string | null }> {
	const d = getDataRepo(env);
	const j = await getContents(d.repo, d.branch, path, token);
	if (j) return { text: b64decodeUtf8(j.content), sha: j.sha };
	if (d.separate) {
		const site = getRepo();
		const legacy = await getContents(site.repo, site.branch, path, token).catch(() => null);
		if (legacy) return { text: b64decodeUtf8(legacy.content), sha: null };
	}
	return { text: null, sha: null };
}

/** Escribe (crea o reemplaza) un archivo en el repo de datos. Devuelve la respuesta de GitHub. */
export async function writeData(path: string, content: string, sha: string | null, message: string, token: string,
	env?: Record<string, string | undefined>, isBase64 = false): Promise<any> {
	const d = getDataRepo(env);
	const body: Record<string, unknown> = { message, content: isBase64 ? content : b64encodeUtf8(content), branch: d.branch };
	if (sha) body.sha = sha;
	const res = await fetch(`https://api.github.com/repos/${d.repo}/contents/${enc(path)}`, {
		method: 'PUT',
		headers: headers(token, { 'Content-Type': 'application/json' }),
		body: JSON.stringify(body),
	});
	const j = await res.json();
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${j.message ?? ''}`);
	return j;
}

/** Lee un archivo binario (foto) del repo de datos. */
export async function readBinary(path: string, token: string, env?: Record<string, string | undefined>): Promise<ArrayBuffer | null> {
	const d = getDataRepo(env);
	const res = await fetch(`https://api.github.com/repos/${d.repo}/contents/${enc(path)}?ref=${d.branch}`, {
		headers: headers(token, { Accept: 'application/vnd.github.raw' }),
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub ${res.status}`);
	return res.arrayBuffer();
}
