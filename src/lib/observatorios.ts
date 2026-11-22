// Datos de los observatorios propios que se muestran en el diario:
// - Industria metalúrgica (repo Alvarorfontana/miprimerrepo, robots que leen INDEC y la Cámara del Acero).
// - DOTS · clima y ríos (repo Alvarorfontana/observatorio-agro, robots que leen NOAA y alturas de ríos).
// Solo se LEEN los archivos públicos que esos robots ya publican: no se toca ningún otro repo.
// Si algo no responde, el bloque correspondiente no se muestra.

const RAW = 'https://raw.githubusercontent.com/Alvarorfontana';

async function leer(url: string): Promise<any | null> {
	try {
		const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (r.ok) return await r.json();
	} catch {}
	return null;
}

export interface Punto { periodo: string; valor: number }

export interface DatosIndustria {
	actualizado: string;
	ucMetalmecanica: Punto[];
	ucGeneral: Punto[];
	ucMetalicas: Punto[];
	acero: { periodo: string; crudo: number; varInteranual: number | null; fuente: string }[];
	plantasRojo: number;
	plantasAmarillo: number;
	plantasTotal: number;
	fuenteIndec: string;
	// Variación interanual de la producción por rama (IPI del INDEC)
	ramas: { nombre: string; variacion: number }[];
	ramasPeriodo: string | null;
	// Puestos de trabajo registrados en el sector (sin terminales automotrices), por trimestre
	empleo: { periodo: string; valor: number }[];
	fuenteEmpleo: string;
	// Importaciones metalúrgicas que compiten con lo hecho acá, millones de dólares por mes
	importaciones: { periodo: string; valor: number }[];
	fuenteImpo: string;
	// Ventas de maquinaria agrícola por trimestre: nacional contra importada (unidades)
	maquinaria: { periodo: string; nacional: number; importada: number }[];
}

export interface DatosClima {
	nino34: Punto[];
	fuenteNino: string;
	fuenteNinoUrl: string;
	// Lluvia de octubre a marzo con El Niño fuerte y con La Niña, frente a años neutrales (%), por ciudad
	lluviaEnso: { ciudad: string; ninoFuerte: number | null; nina: number | null }[];
	lluviaEnsoPeriodo: string;
	rios: null | {
		actualizado: string;
		niveles: Record<string, number>;
		alertas: { lugar: string; rio: string; nivel: string }[];
	};
}

const ultimos = (serie: Punto[] | undefined, n: number) => (serie ?? []).filter((p) => p && p.valor != null).slice(-n);

export async function datosIndustria(): Promise<DatosIndustria | null> {
	const base = `${RAW}/miprimerrepo/main/data`;
	const [indec, acero, semaforo, oede, impo] = await Promise.all([
		leer(`${base}/indec-series.json`),
		leer(`${base}/acero-caa.json`),
		leer(`${base}/semaforo.json`),
		leer(`${base}/empleo-oede.json`),
		leer(`${base}/importaciones.json`),
	]);
	if (!indec?.series) return null;
	const serie = (clave: string) => indec.series.find((s: any) => s.clave === clave);
	const met = serie('uci-metalmecanica');
	if (!met) return null;
	const meses = acero?.meses ? Object.keys(acero.meses).sort() : [];
	const plantas: any[] = semaforo?.plantas ?? [];
	// Producción por rama: último mes contra el mismo mes del año anterior.
	const RAMAS: [string, string][] = [
		['ipi-siderurgia', 'Siderurgia'], ['ipi-fundicion', 'Fundición'], ['ipi-aluminio', 'Aluminio'],
		['ipi-productos-metal', 'Productos de metal'], ['ipi-estructuras-metalicas', 'Estructuras metálicas'],
		['ipi-maquinaria-agropecuaria', 'Maquinaria agrícola'], ['ipi-maquinaria-uso-general', 'Maquinaria general'],
		['ipi-linea-blanca', 'Línea blanca'], ['ipi-electricos', 'Equipos eléctricos'], ['ipi-autopartes', 'Autopartes'],
		['ipi-carrocerias-remolques', 'Carrocerías y remolques'],
	];
	let ramasPeriodo: string | null = null;
	const ramas = RAMAS.map(([clave, nombre]) => {
		const d: Punto[] = serie(clave)?.datos ?? [];
		const u = d.at(-1);
		if (!u) return null;
		const [a, m] = u.periodo.split('-');
		const antes = d.find((p) => p.periodo === `${Number(a) - 1}-${m}`);
		if (!antes?.valor) return null;
		ramasPeriodo = ramasPeriodo ?? u.periodo;
		return { nombre, variacion: Math.round((u.valor / antes.valor - 1) * 1000) / 10 };
	}).filter(Boolean).sort((x: any, y: any) => x.variacion - y.variacion) as { nombre: string; variacion: number }[];

	// Empleo: suma de las ramas metalúrgicas, sin terminales automotrices (como hace la fuente).
	const empleo: { periodo: string; valor: number }[] = [];
	if (oede?.ramas && oede?.trimestres) {
		oede.trimestres.forEach((t: string, i: number) => {
			let total = 0;
			for (const r of Object.values<any>(oede.ramas)) if (r.grupo !== '3410' && typeof r.trim?.[i] === 'number') total += r.trim[i];
			if (total > 0) empleo.push({ periodo: t, valor: total });
		});
	}

	// Importaciones: suma de todos los rubros por mes, últimos 24 meses.
	const sumaImpo: Record<string, number> = {};
	for (const sImpo of impo?.series ?? []) for (const p of sImpo.datos ?? []) if (typeof p.valor === 'number') sumaImpo[p.periodo] = (sumaImpo[p.periodo] ?? 0) + p.valor;
	const importaciones = Object.keys(sumaImpo).sort().slice(-24).map((m) => ({ periodo: m, valor: Math.round(sumaImpo[m]) }));

	// Maquinaria agrícola: tractores + cosechadoras + implementos.
	const trimestres = (serie('maqagro-tractores-nacionales')?.datos ?? []).map((p: Punto) => p.periodo).slice(-8);
	const suma = (tipo: string, t: string) => ['tractores', 'cosechadoras', 'implementos'].reduce((acc, k) => acc + (serie(`maqagro-${k}-${tipo}`)?.datos?.find((p: Punto) => p.periodo === t)?.valor ?? 0), 0);
	const maquinaria = trimestres.map((t: string) => ({ periodo: t, nacional: suma('nacionales', t), importada: suma('importadas', t) }));

	return {
		ramas,
		ramasPeriodo,
		empleo,
		fuenteEmpleo: oede?.url ?? 'https://www.argentina.gob.ar/trabajo/estadisticas',
		importaciones,
		fuenteImpo: 'https://comex.indec.gob.ar/',
		maquinaria,
		actualizado: indec.actualizado,
		ucMetalmecanica: ultimos(met.datos, 36),
		ucGeneral: ultimos(serie('uci-general')?.datos, 36),
		ucMetalicas: ultimos(serie('uci-metalicas')?.datos, 36),
		acero: meses.slice(-12).map((m) => ({ periodo: m, crudo: acero.meses[m].acero_crudo, varInteranual: acero.meses[m].var_interanual ?? null, fuente: acero.meses[m].fuente })),
		plantasRojo: plantas.filter((p) => p.color === 'rojo').length,
		plantasAmarillo: plantas.filter((p) => p.color === 'amarillo').length,
		plantasTotal: plantas.length,
		fuenteIndec: met.url ?? 'https://www.indec.gob.ar/',
	};
}

export async function datosClima(): Promise<DatosClima | null> {
	const base = `${RAW}/observatorio-agro/main`;
	const [enso, crecidas, ensoSA] = await Promise.all([
		leer(`${base}/public/data/enso-ersst.json`),
		leer(`${base}/data/nino_crecidas.json`),
		leer(`${base}/data/enso_sudamerica.json`),
	]);
	// Ciudades argentinas y de la Cuenca del Plata, de norte a sur.
	const CIUDADES: [string, string][] = [
		['salta', 'Salta'], ['tucuman', 'Tucumán'], ['santiago-del-estero', 'Santiago del Estero'], ['formosa', 'Formosa'],
		['asuncion', 'Asunción (PY)'], ['resistencia', 'Resistencia'], ['corrientes', 'Corrientes'], ['posadas', 'Posadas'],
		['encarnacion', 'Encarnación (PY)'], ['reconquista', 'Reconquista'], ['santa-fe', 'Santa Fe'], ['parana', 'Paraná'],
		['cordoba', 'Córdoba'], ['rosario', 'Rosario'], ['salto-uy', 'Salto (UY)'], ['gualeguaychu', 'Gualeguaychú'],
		['pergamino', 'Pergamino'], ['junin', 'Junín'], ['buenos-aires', 'Buenos Aires'], ['montevideo', 'Montevideo (UY)'],
		['mendoza', 'Mendoza'], ['santa-rosa', 'Santa Rosa'], ['bahia-blanca', 'Bahía Blanca'], ['neuquen', 'Neuquén'],
	];
	const lluviaEnso = CIUDADES.map(([id, ciudad]) => {
		const g = ensoSA?.places?.[id]?.warm?.groups;
		if (!g) return null;
		return { ciudad, ninoFuerte: g['El Niño fuerte o muy fuerte']?.vs_neutral_pct ?? null, nina: g['La Niña']?.vs_neutral_pct ?? null };
	}).filter(Boolean) as DatosClima['lluviaEnso'];
	const meses: string[] = enso?.months ?? [];
	const n34: number[] = enso?.indices?.nino34 ?? [];
	const nino34 = meses.map((m, i) => ({ periodo: m, valor: n34[i] })).filter((p) => typeof p.valor === 'number').slice(-36);

	// Los ríos solo se muestran si el dato es reciente (menos de 48 horas):
	// un aviso de crecida viejo no se puede presentar como actual.
	let rios: DatosClima['rios'] = null;
	const act = crecidas?.updated ? new Date(String(crecidas.updated).replace(/(\+\d\d:\d\d)$/, ':00$1')) : null;
	if (act && !isNaN(act.getTime()) && Date.now() - act.getTime() < 48 * 3600_000) {
		rios = {
			actualizado: act.toISOString(),
			niveles: crecidas.niveles ?? {},
			alertas: (crecidas.alertas ?? []).filter((a: any) => a.level !== 'Normal').slice(0, 8).map((a: any) => ({ lugar: a.place, rio: a.river, nivel: a.level })),
		};
	}
	if (!nino34.length && !rios && !lluviaEnso.length) return null;
	return { lluviaEnso, lluviaEnsoPeriodo: ensoSA?.period ?? '', nino34, fuenteNino: enso?.source ?? 'NOAA', fuenteNinoUrl: enso?.source_url ?? 'https://psl.noaa.gov/', rios };
}
