export const prerender = false;

import { getRuntimeEnv } from '../../lib/runtimeEnv';
import { isAdmin } from '../../lib/auth';
import { ghConfig } from '../../lib/github';
import { readData, writeData } from '../../lib/datastore';

const DATA_PATH = 'data/brasil2026-minuto.json';
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

type Item = {
	id: string;
	fecha: string;
	hora: string;
	titulo: string;
	texto: string;
	fuente: string;
	clave: boolean;
	createdAt: string;
};

async function readItems(cfg: any): Promise<{ items: Item[]; sha?: string }> {
	const f = await readData(DATA_PATH, cfg.token);
	if (!f.text) return { items: [], sha: f.sha ?? undefined };
	try {
		const parsed = JSON.parse(f.text);
		return { items: Array.isArray(parsed) ? parsed : [], sha: f.sha ?? undefined };
	} catch {
		return { items: [], sha: f.sha ?? undefined };
	}
}

export const GET = async ({ locals }: any) => {
	const cfg = ghConfig(getRuntimeEnv(locals));
	if (!cfg) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);
	try {
		const { items } = await readItems(cfg);
		return json({ ok: true, items });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const POST = async ({ request, locals }: any) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return json({ ok: false, error: 'No autorizado' }, 401);
	const cfg = ghConfig(env);
	if (!cfg) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);

	try {
		const body = await request.json();
		const titulo = String(body.titulo || '').trim();
		const texto = String(body.texto || '').trim();
		if (!titulo || !texto) return json({ ok: false, error: 'Faltan título o texto' }, 400);

		const actual = await readItems(cfg);
		const item: Item = {
			id: crypto.randomUUID(),
			fecha: String(body.fecha || new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })).toUpperCase(),
			hora: String(body.hora || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })),
			titulo,
			texto,
			fuente: String(body.fuente || 'Diario Federal').trim(),
			clave: body.clave === true,
			createdAt: new Date().toISOString(),
		};
		const items = [item, ...actual.items];
		const sha = (await writeData(DATA_PATH, JSON.stringify(items, null, 2) + '\n', actual.sha ?? null, `Brasil 2026 minuto a minuto: ${titulo.slice(0, 55)}`, cfg.token))?.content?.sha;
		return json({ ok: true, item, sha });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const DELETE = async ({ request, locals }: any) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return json({ ok: false, error: 'No autorizado' }, 401);
	const cfg = ghConfig(env);
	if (!cfg) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);

	try {
		const id = new URL(request.url).searchParams.get('id');
		if (!id) return json({ ok: false, error: 'Falta id' }, 400);
		const actual = await readItems(cfg);
		const items = actual.items.filter((x) => x.id !== id);
		if (items.length === actual.items.length) return json({ ok: false, error: 'No existe la actualización' }, 404);
		await writeData(DATA_PATH, JSON.stringify(items, null, 2) + '\n', actual.sha ?? null, 'Eliminar actualización Brasil 2026', cfg.token);
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};
