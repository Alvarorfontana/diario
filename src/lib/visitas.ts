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
		['EXPIRE', k, GUARDAR_DIAS * 24 * 60 * 60],
	]);
	return r !== null;
}

// ---- Contador privado del panel (/admin/visitas) ----
// Guarda 31 días: páginas vistas por día y personas distintas por día (HyperLogLog sobre un
// código anónimo de conexión + navegador; no se guarda la IP ni se usan cookies).
const GUARDAR_DIAS = 31;

function dia(d: Date): string {
	return clave(d).slice('visitas:'.length);
}

export async function sumarPagina(visitante: string, locals?: unknown): Promise<boolean> {
	const cfg = config(locals);
	if (!cfg) return false;
	const d = dia(new Date());
	const ttl = GUARDAR_DIAS * 24 * 60 * 60;
	const r = await pipeline(cfg, [
		['INCR', 'paginas:' + d],
		['EXPIRE', 'paginas:' + d, ttl],
		['PFADD', 'personas:' + d, visitante],
		['EXPIRE', 'personas:' + d, ttl],
	]);
	return r !== null;
}

export interface ResumenVisitas {
	dias: { fecha: string; paginas: number; personas: number; notas: number }[];
	notas: { slug: string; visitas: number }[];
}

/** Resumen para el panel: últimos `cantidadDias` días y notas más leídas del período. */
export async function resumenVisitas(cantidadDias = 30, locals?: unknown): Promise<ResumenVisitas | null> {
	const cfg = config(locals);
	if (!cfg) return null;
	const ahora = Date.now();
	const fechas = Array.from({ length: cantidadDias }, (_, i) => dia(new Date(ahora - i * 24 * 60 * 60 * 1000)));
	const comandos: (string | number)[][] = [];
	for (const f of fechas) {
		comandos.push(['GET', 'paginas:' + f], ['PFCOUNT', 'personas:' + f], ['ZRANGE', 'visitas:' + f, 0, -1, 'WITHSCORES']);
	}
	const r = await pipeline(cfg, comandos);
	if (!r) return null;
	const porNota = new Map<string, number>();
	const dias = fechas.map((fecha, i) => {
		const lista: string[] = Array.isArray(r[i * 3 + 2]?.result) ? r[i * 3 + 2].result : [];
		let notas = 0;
		for (let j = 0; j + 1 < lista.length; j += 2) {
			const n = Number(lista[j + 1] || 0);
			notas += n;
			porNota.set(lista[j], (porNota.get(lista[j]) ?? 0) + n);
		}
		return { fecha, paginas: Number(r[i * 3]?.result || 0), personas: Number(r[i * 3 + 1]?.result || 0), notas };
	});
	const notas = [...porNota.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([slug, visitas]) => ({ slug, visitas }));
	return { dias, notas };
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

// ---- Detalle de cada visita (26/11/2026) ----
// Un solo hash por día ("detalle:AAAA-MM-DD") con campos "variable|valor" → cantidad.
// Cada página vista hace UNA llamada (un script) a Redis, para no gastar la cuota gratuita.
// No se guarda la IP ni nada que identifique a una persona: solo totales.

const SCRIPT_PAGINA = `
local ttl = tonumber(ARGV[1])
redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], ttl)
redis.call('PFADD', KEYS[2], ARGV[2]); redis.call('EXPIRE', KEYS[2], ttl)
for i = 3, #ARGV do redis.call('HINCRBY', KEYS[3], ARGV[i], 1) end
redis.call('EXPIRE', KEYS[3], ttl)
return 1`;

const SCRIPT_SUMAS = `
local ttl = tonumber(ARGV[1])
for i = 2, #ARGV, 2 do redis.call('HINCRBY', KEYS[1], ARGV[i], tonumber(ARGV[i + 1])) end
redis.call('EXPIRE', KEYS[1], ttl)
return 1`;

function limpio(v: string, max = 120): string {
	return String(v ?? '').replace(/[|\r\n\t]/g, ' ').trim().slice(0, max) || 'Sin dato';
}

/** Suma una página vista con todas sus variables. `campos` = { variable: valor }. */
export async function sumarPaginaDetalle(visitante: string, campos: Record<string, string>, locals?: unknown): Promise<boolean> {
	const cfg = config(locals);
	if (!cfg) return false;
	const d = dia(new Date());
	const ttl = GUARDAR_DIAS * 24 * 60 * 60;
	const pares = Object.entries(campos).map(([k, v]) => `${k}|${limpio(v)}`);
	const r = await pipeline(cfg, [['EVAL', SCRIPT_PAGINA, 3, 'paginas:' + d, 'personas:' + d, 'detalle:' + d, ttl, visitante, ...pares]]);
	return r !== null;
}

/** Suma tiempo de lectura y hasta dónde se leyó una página. */
export async function sumarLectura(ruta: string, segundos: number, scroll: number, locals?: unknown): Promise<boolean> {
	const cfg = config(locals);
	if (!cfg) return false;
	const d = dia(new Date());
	const ttl = GUARDAR_DIAS * 24 * 60 * 60;
	const r0 = limpio(ruta, 160);
	const tramo =
		segundos < 10 ? '1 · menos de 10 s' :
		segundos < 30 ? '2 · 10 a 30 s' :
		segundos < 60 ? '3 · 30 s a 1 min' :
		segundos < 180 ? '4 · 1 a 3 min' :
		segundos < 300 ? '5 · 3 a 5 min' : '6 · más de 5 min';
	const sumas: (string | number)[] = [
		`tiempo|${r0}`, Math.round(segundos),
		`salidas|${r0}`, 1,
		`mitad|${r0}`, scroll >= 50 ? 1 : 0,
		`completa|${r0}`, scroll >= 90 ? 1 : 0,
		`permanencia|${tramo}`, 1,
	];
	const r = await pipeline(cfg, [['EVAL', SCRIPT_SUMAS, 1, 'detalle:' + d, ttl, ...sumas]]);
	return r !== null;
}

/** Junta los detalles de los últimos `cantidadDias` días: { variable: { valor: cantidad } }. */
export async function detalleVisitas(cantidadDias = 7, locals?: unknown): Promise<Record<string, Record<string, number>> | null> {
	const cfg = config(locals);
	if (!cfg) return null;
	const ahora = Date.now();
	const fechas = Array.from({ length: cantidadDias }, (_, i) => dia(new Date(ahora - i * 24 * 60 * 60 * 1000)));
	const r = await pipeline(cfg, fechas.map((f) => ['HGETALL', 'detalle:' + f]));
	if (!r) return null;
	const out: Record<string, Record<string, number>> = {};
	for (const item of r) {
		const lista: string[] = Array.isArray(item?.result) ? item.result : [];
		for (let i = 0; i + 1 < lista.length; i += 2) {
			const corte = lista[i].indexOf('|');
			if (corte < 0) continue;
			const variable = lista[i].slice(0, corte);
			const valor = lista[i].slice(corte + 1);
			(out[variable] ??= {})[valor] = (out[variable][valor] ?? 0) + Number(lista[i + 1] || 0);
		}
	}
	return out;
}
