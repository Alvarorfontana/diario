// Laboratorio de datos · actualización diaria (lo corre .github/workflows/laboratorio-datos.yml)
//
// Baja series de fuentes públicas y gratuitas, sin clave, y las guarda en data/laboratorio/.
// Las páginas del sitio leen esos archivos: no dependen de que la fuente responda cuando entra un lector.
// Si una fuente falla, se conserva el último archivo bueno (nunca se pisa con datos vacíos).
//
// Uso: node scripts/datos/actualizar-laboratorio.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'data', 'laboratorio');
mkdirSync(DIR, { recursive: true });

const hoy = new Date().toISOString().slice(0, 10);
const haceAnios = (n) => `${new Date().getFullYear() - n}-01-01`;

async function pedir(url, intentos = 3) {
	let ultimo;
	for (let i = 0; i < intentos; i++) {
		try {
			const r = await fetch(url, { headers: { 'User-Agent': 'DiarioFederal-Laboratorio/1.0 (+https://www.diariofederal.com.ar)', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return await r.json();
		} catch (e) {
			ultimo = e;
			await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
		}
	}
	throw ultimo;
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const redondear = (v, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

function guardar(nombre, contenido) {
	writeFileSync(join(DIR, `${nombre}.json`), JSON.stringify({ ...contenido, actualizado: hoy }, null, 1) + '\n');
}

// ---------- Fuentes ----------

// Inflación (IPC nacional, INDEC) vía API Series de Tiempo de datos.gob.ar. Respaldo: ArgentinaDatos.
async function inflacion() {
	const id = '148.3_INIVELNAL_DICI_M_26';
	try {
		const url = `https://apis.datos.gob.ar/series/api/series/?ids=${id}:percent_change,${id}:percent_change_a_year_ago&start_date=2017-01-01&limit=1000&format=json`;
		const j = await pedir(url);
		const serie = (j.data || [])
			.map(([fecha, m, a]) => ({ fecha: String(fecha).slice(0, 7), mensual: redondear(num(m) === null ? null : num(m) * 100, 1), interanual: redondear(num(a) === null ? null : num(a) * 100, 1) }))
			.filter((p) => p.mensual !== null);
		if (serie.length < 12) throw new Error('serie corta');
		return { titulo: 'Inflación (IPC nacional)', unidad: '%', fuente: 'INDEC vía API Series de Tiempo (datos.gob.ar)', fuente_url: 'https://datos.gob.ar/series', serie };
	} catch (e) {
		console.warn('  datos.gob.ar no respondió, uso ArgentinaDatos:', e.message);
		const [m, a] = await Promise.all([
			pedir('https://api.argentinadatos.com/v1/finanzas/indices/inflacion'),
			pedir('https://api.argentinadatos.com/v1/finanzas/indices/inflacionInteranual').catch(() => []),
		]);
		const inter = new Map(a.map((p) => [String(p.fecha).slice(0, 7), num(p.valor)]));
		const serie = m
			.map((p) => ({ fecha: String(p.fecha).slice(0, 7), mensual: redondear(num(p.valor), 1), interanual: redondear(inter.get(String(p.fecha).slice(0, 7)) ?? null, 1) }))
			.filter((p) => p.fecha >= '2017-01' && p.mensual !== null);
		if (serie.length < 12) throw new Error('serie corta');
		return { titulo: 'Inflación (IPC nacional)', unidad: '%', fuente: 'INDEC vía ArgentinaDatos', fuente_url: 'https://argentinadatos.com', serie };
	}
}

// Riesgo país (EMBI, JP Morgan) vía ArgentinaDatos.
async function riesgoPais() {
	const j = await pedir('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais');
	const serie = j.map((p) => ({ fecha: String(p.fecha).slice(0, 10), valor: num(p.valor) })).filter((p) => p.valor !== null && p.fecha >= haceAnios(3));
	if (serie.length < 30) throw new Error('serie corta');
	return { titulo: 'Riesgo país', unidad: 'puntos básicos', fuente: 'JP Morgan (EMBI) vía ArgentinaDatos', fuente_url: 'https://argentinadatos.com', serie };
}

// Dólar oficial, blue y MEP (venta) vía ArgentinaDatos.
async function dolar() {
	const casas = ['oficial', 'blue', 'bolsa'];
	const datos = await Promise.all(casas.map((c) => pedir(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${c}`).catch(() => [])));
	const porFecha = new Map();
	datos.forEach((lista, i) => {
		for (const p of lista) {
			const f = String(p.fecha).slice(0, 10);
			if (f < haceAnios(2)) continue;
			const fila = porFecha.get(f) || { fecha: f };
			fila[casas[i] === 'bolsa' ? 'mep' : casas[i]] = num(p.venta);
			porFecha.set(f, fila);
		}
	});
	const serie = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).filter((p) => p.oficial || p.blue);
	if (serie.length < 30) throw new Error('serie corta');
	return { titulo: 'Dólar (venta)', unidad: '$ por dólar', fuente: 'ArgentinaDatos (BCRA y mercado)', fuente_url: 'https://argentinadatos.com', serie };
}

// Reservas internacionales del BCRA (millones de USD) vía API oficial del BCRA, v4.0.
async function reservas() {
	const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/1?desde=${haceAnios(3)}&hasta=${hoy}&limit=3000`;
	const j = await pedir(url);
	// La v4.0 devuelve results[].detalle[] con { fecha, valor }; se busca de forma tolerante.
	const puntos = [];
	const recorrer = (o) => {
		if (Array.isArray(o)) o.forEach(recorrer);
		else if (o && typeof o === 'object') {
			if ('fecha' in o && 'valor' in o) puntos.push({ fecha: String(o.fecha).slice(0, 10), valor: num(o.valor) });
			else Object.values(o).forEach(recorrer);
		}
	};
	recorrer(j.results ?? j);
	const serie = puntos.filter((p) => p.valor !== null).sort((a, b) => a.fecha.localeCompare(b.fecha));
	if (serie.length < 30) throw new Error('serie corta');
	return { titulo: 'Reservas internacionales del BCRA', unidad: 'millones de USD', fuente: 'BCRA · API Estadísticas Monetarias v4.0', fuente_url: 'https://www.bcra.gob.ar/apis-banco-central/', serie };
}

// Crecimiento, inflación y desempleo con proyecciones del FMI (World Economic Outlook) para la región.
async function fmi() {
	const paises = { ARG: 'Argentina', BRA: 'Brasil', CHL: 'Chile', URY: 'Uruguay', PRY: 'Paraguay', BOL: 'Bolivia' };
	const indicadores = { NGDP_RPCH: 'Crecimiento del PIB', PCPIPCH: 'Inflación promedio anual', LUR: 'Desempleo' };
	const anioActual = new Date().getFullYear();
	const out = {};
	for (const [cod, nombre] of Object.entries(indicadores)) {
		const j = await pedir(`https://www.imf.org/external/datamapper/api/v1/${cod}/${Object.keys(paises).join('/')}`);
		const valores = j?.values?.[cod] || {};
		out[cod] = {
			nombre,
			paises: Object.fromEntries(
				Object.entries(paises).map(([iso, nom]) => [
					nom,
					Object.fromEntries(
						Object.entries(valores[iso] || {})
							.filter(([anio]) => Number(anio) >= anioActual - 10 && Number(anio) <= anioActual + 2)
							.map(([anio, v]) => [anio, redondear(num(v), 1)]),
					),
				]),
			),
		};
	}
	if (!Object.values(out.NGDP_RPCH.paises).some((s) => Object.keys(s).length)) throw new Error('sin datos');
	return { titulo: 'Proyecciones del FMI', unidad: '%', fuente: 'FMI · World Economic Outlook (DataMapper)', fuente_url: 'https://www.imf.org/external/datamapper', anio_actual: anioActual, indicadores: out };
}

// ---------- Corrida ----------

const fuentes = { inflacion, 'riesgo-pais': riesgoPais, dolar, reservas, fmi };
const estado = existsSync(join(DIR, 'estado.json')) ? JSON.parse(readFileSync(join(DIR, 'estado.json'), 'utf8')) : {};
let ok = 0;

for (const [nombre, fn] of Object.entries(fuentes)) {
	process.stdout.write(`· ${nombre}… `);
	try {
		const datos = await fn();
		guardar(nombre, datos);
		estado[nombre] = { ok: true, ultimo_ok: hoy, puntos: datos.serie?.length ?? null };
		ok++;
		console.log(`ok (${datos.serie ? datos.serie.length + ' puntos' : 'listo'})`);
	} catch (e) {
		estado[nombre] = { ...(estado[nombre] || {}), ok: false, ultimo_intento: hoy, error: String(e.message || e).slice(0, 200) };
		console.log(`FALLÓ: ${e.message} (se conserva el archivo anterior)`);
	}
}

writeFileSync(join(DIR, 'estado.json'), JSON.stringify(estado, null, 1) + '\n');
console.log(`\n${ok}/${Object.keys(fuentes).length} fuentes actualizadas.`);
