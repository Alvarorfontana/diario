// API del panel "Video flash" (/admin/flash).
// Los flashes viven en data/flash/<id>.json; las fotos y videos, en data/flash/media/<id>/.
// Los guardados intermedios llevan [sin-deploy] para no publicar el sitio en cada paso
// (ver vercel.json). El video lo arma GitHub Actions (.github/workflows/flash.yml).
export const prerender = false;

import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { isAdmin } from '../../../lib/auth';
import { ghConfig, getFile, putFile, putBase64, deleteFile, listDirAll } from '../../../lib/github';

const DIR = 'data/flash';
const ESPECIALES = new Set(['pronunciacion.json', 'calibracion.json']);
const SIN_DEPLOY = '[sin-deploy]';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const idValido = (id: unknown) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{2,80}$/.test(id);
const nombreValido = (n: unknown) => typeof n === 'string' && /^[a-z0-9][a-z0-9._-]{1,80}$/.test(n);

async function guard(request: Request, locals: any) {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return { error: json({ ok: false, error: 'No autorizado' }, 401) };
	const cfg = ghConfig(env);
	if (!cfg) return { error: json({ ok: false, error: 'Falta la variable GITHUB_PAT en Vercel' }, 500) };
	return { cfg };
}

const corto = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

// Deja sólo los campos conocidos, con sus límites (así el video no se rompe).
function limpiar(f: any, previo: any = {}) {
	const bloques = (Array.isArray(f.bloques) ? f.bloques : []).slice(0, 8).map((b: any) => {
		const m = b?.media && typeof b.media === 'object' ? b.media : null;
		const media = m && typeof m.archivo === 'string' && /^(data\/flash\/media\/|\/flash\/|\/uploads\/)[\w./-]+$/.test(m.archivo) && !m.archivo.includes('..')
			? {
				tipo: m.tipo === 'video' ? 'video' : 'foto',
				archivo: m.archivo,
				...(m.tipo === 'video' ? { inicio: Math.max(0, Math.min(600, Number(m.inicio) || 0)) } : {}),
				...(Array.isArray(m.foco) ? { foco: [Math.max(0, Math.min(1, Number(m.foco[0]) || 0.5)), Math.max(0, Math.min(1, Number(m.foco[1]) || 0.4))] } : {}),
				...(m.vista ? { vista: corto(m.vista, 300) } : {}),
			}
			: undefined;
		return {
			kicker: corto(b?.kicker, 30),
			titulo: corto(b?.titulo, 60),
			dato: corto(b?.dato, 26),
			bajada: corto(b?.bajada, 110),
			texto: corto(b?.texto, 900),
			epigrafe: corto(b?.epigrafe, 60),
			fuente: corto(b?.fuente, 80),
			...(media ? { media } : {}),
		};
	});
	const musica = typeof f.musica === 'string' && /^(\/flash\/musica\/|data\/flash\/musica\/)[\w.-]+$/.test(f.musica) ? f.musica : '/flash/musica/paulyudin.mp3';
	const out: any = {
		id: f.id,
		tipo: f.tipo === 'ultimo' ? 'ultimo' : 'semanal',
		titulo: corto(f.titulo, 140),
		fecha: /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) ? f.fecha : new Date().toISOString().slice(0, 10),
		voz: /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(f.voz) ? f.voz : 'es-AR-TomasNeural',
		velocidad: Math.max(-20, Math.min(30, Math.round(Number(f.velocidad) || 0))),
		musica,
		volumenMusica: Math.max(-30, Math.min(-6, Number(f.volumenMusica) || -17)),
		...(corto(f.intro, 200) ? { intro: corto(f.intro, 200) } : {}),
		...(corto(f.cierre, 200) ? { cierre: corto(f.cierre, 200) } : {}),
		bloques,
		estado: previo.estado || 'borrador',
		publicado: previo.publicado === true,
	};
	// lo que dejó el último video generado
	for (const k of ['video', 'miniatura', 'version', 'duracion', 'duraciones', 'generado', 'error', 'rotulo']) if (previo[k] !== undefined) out[k] = previo[k];
	return out;
}

export const GET = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const cfg = g.cfg!;
	const url = new URL(request.url);
	const action = url.searchParams.get('action');
	try {
		if (action === 'list') {
			const files = (await listDirAll(cfg, DIR)).filter((f) => f.type === 'file' && f.name.endsWith('.json') && !ESPECIALES.has(f.name));
			const items = await Promise.all(files.map(async (f) => {
				const file = await getFile(cfg, f.path);
				if (!file) return null;
				try {
					const d = JSON.parse(file.text);
					return { id: d.id, titulo: d.titulo, tipo: d.tipo, fecha: d.fecha, estado: d.estado, publicado: d.publicado === true, video: d.video, version: d.version, duracion: d.duracion, error: d.error };
				} catch { return null; }
			}));
			return json({ ok: true, items: items.filter(Boolean).sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha))) });
		}
		if (action === 'get') {
			const id = url.searchParams.get('id');
			if (!idValido(id)) return json({ ok: false, error: 'Id inválido' }, 400);
			const file = await getFile(cfg, `${DIR}/${id}.json`);
			if (!file) return json({ ok: false, error: 'No existe ese flash' }, 404);
			return json({ ok: true, sha: file.sha, flash: JSON.parse(file.text) });
		}
		if (action === 'config') {
			const [pron, calib, musicaPropia] = await Promise.all([
				getFile(cfg, `${DIR}/pronunciacion.json`),
				getFile(cfg, `${DIR}/calibracion.json`),
				listDirAll(cfg, `${DIR}/musica`),
			]);
			const propias = Array.from(new Set(musicaPropia.filter((f) => f.type === 'file').map((f) => f.name.replace(/\.part\d+$/, ''))));
			return json({
				ok: true,
				pronunciacion: pron ? JSON.parse(pron.text) : {},
				pronunciacionSha: pron?.sha ?? null,
				calibracion: calib ? JSON.parse(calib.text) : {},
				musicaPropia: propias.map((n) => ({ nombre: n, ruta: `${DIR}/musica/${n}` })),
			});
		}
		return json({ ok: false, error: 'Acción desconocida' }, 400);
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const POST = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const cfg = g.cfg!;
	try {
		const ct = request.headers.get('content-type') || '';
		// Subida de una parte de un archivo (fotos, videos, música). Cada parte pesa menos de 3 MB.
		if (ct.includes('multipart/form-data')) {
			const fd = await request.formData();
			const destino = String(fd.get('destino') || '');
			const nombre = String(fd.get('nombre') || '');
			const parte = Number(fd.get('parte') || 0);
			const file = fd.get('file');
			if (!(file instanceof File)) return json({ ok: false, error: 'No llegó el archivo' }, 400);
			if (file.size > 3_200_000) return json({ ok: false, error: 'Parte demasiado grande' }, 400);
			if (!nombreValido(nombre) || !Number.isInteger(parte) || parte < 0 || parte > 60) return json({ ok: false, error: 'Nombre inválido' }, 400);
			const carpeta = destino === 'musica' ? `${DIR}/musica` : idValido(destino) ? `${DIR}/media/${destino}` : null;
			if (!carpeta) return json({ ok: false, error: 'Destino inválido' }, 400);
			const bytes = new Uint8Array(await file.arrayBuffer());
			let bin = '';
			for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
			const ruta = `${carpeta}/${nombre}.part${String(parte).padStart(3, '0')}`;
			await putBase64(cfg, ruta, btoa(bin), `${SIN_DEPLOY} Flash: subir ${nombre} (${parte + 1})`);
			return json({ ok: true, archivo: `${carpeta}/${nombre}` });
		}

		const body = await request.json();
		if (body.action === 'guardar') {
			const f = body.flash || {};
			if (!idValido(f.id)) return json({ ok: false, error: 'Id inválido' }, 400);
			const ruta = `${DIR}/${f.id}.json`;
			const actual = await getFile(cfg, ruta);
			if (actual && !body.sha) return json({ ok: false, error: 'Ya existe un flash con ese nombre' }, 409);
			if (actual && body.sha !== actual.sha) return json({ ok: false, error: 'El flash cambió mientras lo editabas (quizás terminó de generarse). Recargalo y volvé a guardar.' }, 409);
			const previo = actual ? JSON.parse(actual.text) : {};
			const limpio = limpiar(f, previo);
			if (body.generar) {
				if (!limpio.bloques.some((b: any) => b.texto)) return json({ ok: false, error: 'Falta el texto de al menos una noticia' }, 400);
				const sinFuente = limpio.bloques.findIndex((b: any) => b.media && !b.fuente);
				if (sinFuente >= 0) return json({ ok: false, error: `La noticia ${sinFuente + 1} tiene foto o video pero no tiene fuente` }, 400);
				limpio.estado = 'generar';
				delete limpio.error;
			}
			const msg = body.generar ? `${SIN_DEPLOY} Flash: generar video ${f.id}` : `${SIN_DEPLOY} Flash: guardar ${f.id}`;
			const sha = await putFile(cfg, ruta, JSON.stringify(limpio, null, 2) + '\n', msg, actual?.sha);
			return json({ ok: true, sha, flash: limpio });
		}
		if (body.action === 'publicar') {
			if (!idValido(body.id)) return json({ ok: false, error: 'Id inválido' }, 400);
			const ruta = `${DIR}/${body.id}.json`;
			const actual = await getFile(cfg, ruta);
			if (!actual) return json({ ok: false, error: 'No existe ese flash' }, 404);
			const d = JSON.parse(actual.text);
			if (body.publicado && !d.video) return json({ ok: false, error: 'Primero generá el video' }, 400);
			d.publicado = body.publicado === true;
			if (d.publicado && !d.publicadoEl) d.publicadoEl = new Date().toISOString();
			// Sin [sin-deploy]: publicar o despublicar actualiza el sitio
			const sha = await putFile(cfg, ruta, JSON.stringify(d, null, 2) + '\n', `Flash: ${d.publicado ? 'publicar' : 'despublicar'} ${body.id}`, actual.sha);
			return json({ ok: true, sha, flash: d });
		}
		if (body.action === 'pronunciacion') {
			const dicc: Record<string, string> = {};
			for (const [k, v] of Object.entries(body.pronunciacion || {})) {
				const kk = corto(k, 60), vv = corto(v, 80);
				if (kk && vv) dicc[kk] = vv;
			}
			const actual = await getFile(cfg, `${DIR}/pronunciacion.json`);
			await putFile(cfg, `${DIR}/pronunciacion.json`, JSON.stringify(dicc, null, 2) + '\n', `${SIN_DEPLOY} Flash: pronunciación`, actual?.sha);
			return json({ ok: true });
		}
		return json({ ok: false, error: 'Acción desconocida' }, 400);
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const DELETE = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const id = new URL(request.url).searchParams.get('id');
	if (!idValido(id)) return json({ ok: false, error: 'Id inválido' }, 400);
	try {
		const actual = await getFile(g.cfg!, `${DIR}/${id}.json`);
		if (!actual) return json({ ok: false, error: 'No existe ese flash' }, 404);
		await deleteFile(g.cfg!, `${DIR}/${id}.json`, actual.sha, `Flash: borrar ${id}`);
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};
