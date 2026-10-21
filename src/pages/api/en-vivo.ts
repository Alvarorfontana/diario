export const prerender = false;

// API de coberturas en vivo.
//   GET  /api/en-vivo              → lista de coberturas (resumen), la más nueva primero
//   GET  /api/en-vivo?id=<id>      → una cobertura con todas sus entradas
//   POST /api/en-vivo  (admin)     → { accion: 'crear' | 'agregar' | 'cerrar' | 'reabrir', ... }
//   DELETE /api/en-vivo?cobertura=<id>&entrada=<id>  (admin) → borra una entrada
import { getRuntimeEnv } from '../../lib/runtimeEnv';
import { isAdmin } from '../../lib/auth';
import { ghConfig } from '../../lib/github';
import { SECCIONES } from '../../consts';
import { fechaAR, horaAR, leer, modificar, nuevoId, resumen, type Cobertura, type Entrada } from '../../lib/envivo';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

class ErrorPedido extends Error {
	constructor(message: string, public status = 400) { super(message); }
}

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export const GET = async ({ url, locals }: any) => {
	const env = getRuntimeEnv(locals);
	const cfg = ghConfig(env);
	if (!cfg) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);
	try {
		const { coberturas } = await leer(cfg.token, env);
		const id = url.searchParams.get('id');
		if (id) {
			const c = coberturas.find((x) => x.id === id);
			if (!c) return json({ ok: false, error: 'No existe esa cobertura' }, 404);
			return json({ ok: true, cobertura: { ...c, entradas: [...c.entradas].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) } });
		}
		const lista = coberturas.map(resumen).sort((a, b) => (b.ultima?.createdAt || b.creada).localeCompare(a.ultima?.createdAt || a.creada));
		return json({ ok: true, coberturas: lista });
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
		const accion = String(body.accion || '');

		if (accion === 'crear') {
			const titulo = texto(body.titulo, 120);
			if (!titulo) throw new ErrorPedido('Falta el título de la cobertura');
			const seccion = SECCIONES.some((s) => s.id === body.seccion) ? String(body.seccion) : 'argentina';
			const cobertura = await modificar(cfg.token, env, `En vivo: nueva cobertura «${titulo.slice(0, 50)}»`, (cs) => {
				const c: Cobertura = {
					id: nuevoId(titulo, cs), titulo, bajada: texto(body.bajada, 300), seccion,
					estado: 'activa', creada: new Date().toISOString(), entradas: [],
				};
				cs.push(c);
				return c;
			});
			return json({ ok: true, cobertura });
		}

		const id = String(body.cobertura || '');
		const buscar = (cs: Cobertura[]) => {
			const c = cs.find((x) => x.id === id);
			if (!c) throw new ErrorPedido('No existe esa cobertura', 404);
			return c;
		};

		if (accion === 'agregar') {
			const titulo = texto(body.titulo, 140), cuerpo = texto(body.texto, 4000);
			if (!titulo || !cuerpo) throw new ErrorPedido('Faltan título o texto');
			const entrada = await modificar(cfg.token, env, `En vivo (${id}): ${titulo.slice(0, 55)}`, (cs) => {
				const c = buscar(cs);
				if (c.estado !== 'activa') throw new ErrorPedido('La cobertura está cerrada: reabrila para sumar entradas');
				const ahora = new Date();
				const e: Entrada = {
					id: crypto.randomUUID(), fecha: fechaAR(ahora), hora: texto(body.hora, 5) || horaAR(ahora),
					titulo, texto: cuerpo, fuente: texto(body.fuente, 120) || 'EL DIARIO', clave: body.clave === true,
					createdAt: ahora.toISOString(),
				};
				c.entradas.unshift(e);
				return e;
			});
			return json({ ok: true, entrada });
		}

		if (accion === 'cerrar' || accion === 'reabrir') {
			const c = await modificar(cfg.token, env, `En vivo (${id}): ${accion === 'cerrar' ? 'cobertura cerrada' : 'cobertura reabierta'}`, (cs) => {
				const c = buscar(cs);
				c.estado = accion === 'cerrar' ? 'cerrada' : 'activa';
				if (accion === 'cerrar') c.cerrada = new Date().toISOString(); else delete c.cerrada;
				return c;
			});
			return json({ ok: true, cobertura: resumen(c) });
		}

		throw new ErrorPedido('Acción desconocida');
	} catch (e: any) {
		return json({ ok: false, error: e.message }, e instanceof ErrorPedido ? e.status : 500);
	}
};

export const DELETE = async ({ request, url, locals }: any) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return json({ ok: false, error: 'No autorizado' }, 401);
	const cfg = ghConfig(env);
	if (!cfg) return json({ ok: false, error: 'Falta GITHUB_PAT' }, 500);
	const id = url.searchParams.get('cobertura'), entrada = url.searchParams.get('entrada');
	if (!id || !entrada) return json({ ok: false, error: 'Faltan cobertura o entrada' }, 400);
	try {
		await modificar(cfg.token, env, `En vivo (${id}): entrada eliminada`, (cs) => {
			const c = cs.find((x) => x.id === id);
			if (!c) throw new ErrorPedido('No existe esa cobertura', 404);
			const antes = c.entradas.length;
			c.entradas = c.entradas.filter((e) => e.id !== entrada);
			if (c.entradas.length === antes) throw new ErrorPedido('No existe esa entrada', 404);
		});
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, e instanceof ErrorPedido ? e.status : 500);
	}
};
