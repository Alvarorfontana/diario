// Contador de visitas para "Lo más leído".
// Usa Upstash Redis (plan gratuito), que se agrega desde Vercel > Storage y carga solo las
// variables KV_REST_API_URL y KV_REST_API_TOKEN. Sin esas variables, el contador no hace nada
// y la portada sigue mostrando "Lo último".
import { getRuntimeEnv } from './runtimeEnv';

const DIAS = 3; // ventana del ranking: visitas de hoy y los dos días anteriores

function config(locals?: unknown): { url: string; token: string } | null {
	const env = getRuntimeEnv(locals);
	const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
	return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function visitasActivas(locals?: unknown): boolean {
	return config(locals) !== null;
}

function clave(d: Date): string {
	// Día en horario de Argentina (UTC-3)
	const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
	return 'visitas:' + ar.toISOString().slice(0, 10);
}

async function pipeline(cfg: { url: string; token: string }, comandos: (string | number)[][]): Promise<any[] | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 1500);
	try {
		const res = await fetch(cfg.url + '/pipeline', {
			method: 'POST',
			headers: { Authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
			body: JSON.stringify(comandos.map((c) => c.map(String))),
			signal: ctrl.signal,
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

export async function sumarVisita(slug: string, locals?: unknown): Promise<boolean> {
	const cfg = config(locals);
	if (!cfg) return false;
	const k = clave(new Date());
	const r = await pipeline(cfg, [
		['ZINCRBY', k, 1, slug],
		['EXPIRE', k, (DIAS + 1) * 24 * 60 * 60],
	]);
	return r !== null;
}

/** Devuelve los slugs más leídos de los últimos días, del más al menos leído. */
export async function masLeidas(cantidad = 5, locals?: unknown): Promise<string[]> {
	const cfg = config(locals);
	if (!cfg) return [];
	const ahora = Date.now();
	const claves = Array.from({ length: DIAS }, (_, i) => clave(new Date(ahora - i * 24 * 60 * 60 * 1000)));
	const r = await pipeline(cfg, claves.map((k) => ['ZRANGE', k, 0, 49, 'REV', 'WITHSCORES']));
	if (!r) return [];
	const total = new Map<string, number>();
	for (const item of r) {
		const lista: string[] = Array.isArray(item?.result) ? item.result : [];
		for (let i = 0; i + 1 < lista.length; i += 2) {
			total.set(lista[i], (total.get(lista[i]) ?? 0) + Number(lista[i + 1] || 0));
		}
	}
	return [...total.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, cantidad)
		.map(([slug]) => slug);
}
