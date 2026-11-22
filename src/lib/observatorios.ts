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
}

export interface DatosClima {
	nino34: Punto[];
	fuenteNino: string;
	fuenteNinoUrl: string;
	rios: null | {
		actualizado: string;
		niveles: Record<string, number>;
		alertas: { lugar: string; rio: string; nivel: string }[];
	};
}

const ultimos = (serie: Punto[] | undefined, n: number) => (serie ?? []).filter((p) => p && p.valor != null).slice(-n);

export async function datosIndustria(): Promise<DatosIndustria | null> {
	const base = `${RAW}/miprimerrepo/main/data`;
	const [indec, acero, semaforo] = await Promise.all([
		leer(`${base}/indec-series.json`),
		leer(`${base}/acero-caa.json`),
		leer(`${base}/semaforo.json`),
	]);
	if (!indec?.series) return null;
	const serie = (clave: string) => indec.series.find((s: any) => s.clave === clave);
	const met = serie('uci-metalmecanica');
	if (!met) return null;
	const meses = acero?.meses ? Object.keys(acero.meses).sort() : [];
	const plantas: any[] = semaforo?.plantas ?? [];
	return {
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
	const [enso, crecidas] = await Promise.all([
		leer(`${base}/public/data/enso-ersst.json`),
		leer(`${base}/data/nino_crecidas.json`),
	]);
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
	if (!nino34.length && !rios) return null;
	return { nino34, fuenteNino: enso?.source ?? 'NOAA', fuenteNinoUrl: enso?.source_url ?? 'https://psl.noaa.gov/', rios };
}
