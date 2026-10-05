// Acceso a los archivos del repo vía API de GitHub (las notas viven en el repo).
import { getRepo } from './repo';

export const NOTAS_DIR = 'src/content/articulos';

export interface GhConfig { token: string; repo: string; branch: string }

export function ghConfig(env: Record<string, string | undefined>): GhConfig | null {
	if (!env.GITHUB_PAT) return null;
	return {
		token: env.GITHUB_PAT,
		repo: env.GITHUB_REPO || getRepo().repo,
		branch: env.GITHUB_BRANCH || getRepo().branch,
	};
}

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

function headers(cfg: GhConfig, extra: Record<string, string> = {}) {
	return {
		Authorization: `Bearer ${cfg.token}`,
		Accept: 'application/vnd.github+json',
		'User-Agent': 'eldiario-admin',
		...extra,
	};
}

export function b64encode(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

export function b64decode(b64: string): string {
	const bin = atob(b64.replace(/\n/g, ''));
	return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export async function listDir(cfg: GhConfig, dir: string): Promise<{ name: string; path: string; sha: string }[]> {
	const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${enc(dir)}?ref=${cfg.branch}`, {
		headers: headers(cfg),
		cache: 'no-store',
	});
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
	return (await res.json()).filter((f: any) => f.type === 'file');
}

export async function getFile(cfg: GhConfig, path: string): Promise<{ text: string; sha: string } | null> {
	const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${enc(path)}?ref=${cfg.branch}`, {
		headers: headers(cfg),
		cache: 'no-store',
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
	const j = await res.json();
	return { text: b64decode(j.content), sha: j.sha };
}

export async function putFile(cfg: GhConfig, path: string, text: string, message: string, sha?: string) {
	const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${enc(path)}`, {
		method: 'PUT',
		headers: headers(cfg, { 'Content-Type': 'application/json' }),
		body: JSON.stringify({ message, content: b64encode(text), branch: cfg.branch, ...(sha ? { sha } : {}) }),
	});
	const j = await res.json();
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${j.message ?? ''}`);
	return j.content?.sha as string;
}

export async function deleteFile(cfg: GhConfig, path: string, sha: string, message: string) {
	const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${enc(path)}`, {
		method: 'DELETE',
		headers: headers(cfg, { 'Content-Type': 'application/json' }),
		body: JSON.stringify({ message, sha, branch: cfg.branch }),
	});
	if (!res.ok) throw new Error(`GitHub ${res.status}: ${((await res.json()).message) ?? ''}`);
}
