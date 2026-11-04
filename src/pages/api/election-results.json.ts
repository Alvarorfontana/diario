export const prerender = false;

/**
 * Resultados de civicAPI para /elecciones-eeuu/.
 *
 * Sin parámetros devuelve una "foto" completa y normalizada, compartida por todos
 * los lectores gracias a la caché de Vercel: civicAPI recibe unas pocas consultas
 * por minuto aunque la página tenga miles de visitas.
 *
 * - Senado y Cámara salen de los documentos agregados de civicAPI (dos consultas
 *   para las 470 bancas). Gobernaciones, de la búsqueda.
 * - Si una fuente falla o llega recortada, se conserva su última versión buena.
 * - Los datos de ensayo (`test_data: true`) nunca se publican.
 *
 * Con ?part=senate, ?part=house o ?part=governor entrega una sola parte: la página las
 * pide por separado para que una fuente lenta no demore a las demás.
 * Con ?id= sigue entregando el detalle de una contienda; con ?query= o ?state=, la búsqueda.
 */
const API_BASE = (process.env.CIVICAPI_BASE_URL || 'https://civicapi.org/api/v2').replace(/\/+$/, '');
const SENATE_AGGREGATE_ID = '87528';
const HOUSE_AGGREGATE_ID = '87524';
// Contiendas de gobernación de 2026 en civicAPI.
const GOVERNOR_RACE_IDS: Record<string, number> = {
  AK: 148898, AL: 86908, AR: 86938, CA: 86952, CO: 87018, CT: 87026, FL: 87069, GA: 87088, HI: 87100,
  IA: 87152, ID: 87106, IL: 87130, KS: 87163, MA: 87276, MD: 87198, ME: 87189, MI: 87215, MN: 87230,
  NE: 87255, NH: 87284, NM: 87289, NV: 87260, NY: 87329, OH: 87365, OK: 87582, OR: 87375, PA: 87393,
  RI: 87397, SC: 87410, SD: 87447, TN: 87476, TX: 55857, VT: 87503, WI: 87491, WY: 87497,
};
const ELECTION_DATE = '2026-11-03';
const USER_AGENT = 'DiarioFederal/1.0 (+https://www.diariofederal.com.ar/elecciones-eeuu/)';

// La noche de la elección civicAPI puede tardar decenas de segundos en el documento de la Cámara.
// Va de la mano de maxDuration en astro.config.mjs.
const CYCLE_BUDGET_MS = 50000;
const ATTEMPT_TIMEOUT_MS = 22000;
const MEMORY_REUSE_MS = 20000;
const MIN_RACES = { senate: 20, house: 300, governor: 1 };
const PLACEHOLDER = /^(write[- ]?ins?|scattering|other|others|blank|void|none of these)\b/i;
const OFFICES = ['senate', 'house', 'governor'] as const;

type Office = keyof typeof MIN_RACES;
type Stored = { races: any[]; fetchedAt: string; testData: boolean };

// Última versión buena de cada fuente mientras dure esta instancia del servidor.
const memory: Record<Office, Stored | null> = { senate: null, house: null, governor: null };
const lastSnapshots = new Map<string, { at: number; body: any }>();
const cyclesInFlight = new Map<string, Promise<any>>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const isTrue = (value: unknown) => value === true || value === 'true';

async function requestOnce(path: string, timeoutMs: number) {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  return { status: response.status, body, contentType: response.headers.get('content-type') };
}

/** Un reintento ante corte, demora, 429 o 5xx. civicAPI tira 502 sueltos en plena jornada. */
async function request(path: string, deadline: number) {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 500) break;
    try {
      const result = await requestOnce(path, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
      if (result.status < 500 && result.status !== 429) return result;
      last = new Error(`HTTP ${result.status}`);
    } catch (error) {
      last = error;
    }
    if (attempt === 0) await wait(250 + Math.random() * 450);
  }
  throw last ?? new Error('sin tiempo para consultar');
}

async function requestJson(path: string, deadline: number) {
  const { status, body } = await request(path, deadline);
  if (status >= 400) throw new Error(`HTTP ${status}`);
  return JSON.parse(body);
}

function normalizeCandidates(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && text(row.name) && !PLACEHOLDER.test(text(row.name)))
    // Los candidatos inscriptos por escrito sin votos solo agrandan la respuesta.
    .filter((row) => !/write-?in/i.test(text(row.party)) || number(row.votes) > 0)
    .map((row) => ({
      name: text(row.name),
      party: text(row.party),
      votes: number(row.votes),
      percent: row.percent ?? null,
      winner: isTrue(row.winner),
      advanced: isTrue(row.advanced),
      incumbent: isTrue(row.incumbent),
    }));
}

function statusOf(candidates: any[], percentReporting: number) {
  const winner = candidates.find((candidate) => candidate.winner);
  if (winner) return `Proyección de civicAPI: ${winner.name}`;
  if (candidates.some((candidate) => candidate.advanced)) return 'Pasa a segunda vuelta · civicAPI';
  return percentReporting > 0 || candidates.some((candidate) => candidate.votes > 0) ? 'Conteo parcial' : 'Sin votos informados';
}

function toRace(fields: { id: unknown; office: Office; state: string; district: string | null; name: string; source: any; updatedAt: unknown }) {
  const candidates = normalizeCandidates(fields.source?.candidates);
  const percent = number(fields.source?.percent_reporting);
  return {
    id: text(fields.id),
    office_type: fields.office,
    state: fields.state,
    district: fields.district,
    race_name: fields.name,
    percent_reporting: percent,
    status: statusOf(candidates, percent),
    updated_at: text(fields.updatedAt) || null,
    candidates,
  };
}

function parseAggregate(doc: any, office: 'senate' | 'house') {
  const races: any[] = [];
  const seen = new Set<string>();
  for (const [key, region] of Object.entries<any>(doc?.region_results ?? {})) {
    const match = /^([a-z]{2})(?:-(\d{1,2}|al|s|special))?$/i.exec(key.trim());
    const id = text(region?.election_id);
    if (!match || !id || seen.has(id)) continue;
    seen.add(id);
    const part = match[2]?.toUpperCase() ?? null;
    races.push(toRace({
      id, office,
      state: match[1].toUpperCase(),
      district: office === 'house' ? part : null,
      name: text(region.name) || text(doc?.election_name),
      source: region,
      updatedAt: region.last_updated ?? doc?.last_updated,
    }));
  }
  return races;
}

const searchList = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  for (const key of ['races', 'results', 'data']) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};
const raceId = (race: any) => race?.id ?? race?.race_id ?? race?.election_id;
const raceName = (race: any) => text(race?.election_name) || text(race?.name);
const raceType = (race: any) => `${text(race?.election_type)} ${text(race?.type)}`;

function classify(race: any): Office | null {
  const label = `${raceType(race)} ${raceName(race)}`;
  if (/lieutenant|\blt\.?\s+gov/i.test(label)) return null;
  if (/governor|gubernatorial/i.test(label)) return 'governor';
  if (/\b(us|u\.s\.|united states)\s+senate\b/i.test(label)) return 'senate';
  if (/house of representatives|\b(us|u\.s\.)\s+house\b/i.test(label) && !/state house/i.test(label)) return 'house';
  return null;
}

function fromSearch(found: any[], office: Office) {
  const races = [];
  for (const race of found) {
    const state = text(race?.province).toUpperCase();
    if (!/^[A-Z]{2}$/.test(state) || state === 'US' || classify(race) !== office || isTrue(race?.test_data)) continue;
    if (/primary|runoff/i.test(text(race?.election_scope)) || !raceId(race)) continue;
    const district = office === 'house' ? (text(race?.district).split('-').pop() || null) : null;
    races.push(toRace({ id: raceId(race), office, state, district, name: raceName(race), source: race, updatedAt: race?.last_updated }));
  }
  return races;
}

const dateParams = () => {
  const params = new URLSearchParams({ country: 'US', start_date: ELECTION_DATE, end_date: ELECTION_DATE });
  return params;
};

/** La búsqueda no siempre trae candidatos; se completa con el detalle, de a cuatro por vez. */
async function fillCandidates(found: any[], deadline: number) {
  const pending = found.filter((race) => !Array.isArray(race?.candidates) || race.candidates.length === 0).slice(0, 40);
  for (let index = 0; index < pending.length && Date.now() < deadline - 800; index += 4) {
    await Promise.all(pending.slice(index, index + 4).map(async (race) => {
      try {
        const detail = await requestJson(`race/${encodeURIComponent(String(raceId(race)))}?light=true`, deadline);
        Object.assign(race, { candidates: detail?.candidates, percent_reporting: detail?.percent_reporting, last_updated: detail?.last_updated, test_data: detail?.test_data });
      } catch {
        // Esa contienda queda con su versión anterior o sin candidatos hasta la próxima vuelta.
      }
    }));
  }
}

async function loadGovernorById(state: string, id: number, deadline: number) {
  const doc = await requestJson(`race/${id}?light=true`, deadline);
  const name = raceName(doc);
  if (text(doc?.province).toUpperCase() !== state || !/governor/i.test(name) || /lieutenant/i.test(name)) throw new Error(`race/${id} no es la gobernación de ${state}`);
  return { doc, race: toRace({ id, office: 'governor', state, district: null, name, source: doc, updatedAt: doc?.last_updated }) };
}

/** Arizona no figura en el catálogo: se busca solo su estado, sin frenar al resto si falla. */
async function loadArizonaGovernor(deadline: number) {
  const params = dateParams();
  params.set('province', 'AZ');
  params.set('query', 'Governor');
  params.set('limit', '20');
  const found = searchList(await requestJson(`race/search?${params}`, deadline)).filter((race) => classify(race) === 'governor');
  await fillCandidates(found, deadline);
  return fromSearch(found, 'governor');
}

/** Por número de contienda, porque la búsqueda general de civicAPI falla en plena jornada. */
async function loadGovernors(deadline: number) {
  const entries = Object.entries(GOVERNOR_RACE_IDS);
  const races: any[] = [];
  let testData = false;
  for (let index = 0; index < entries.length && Date.now() < deadline - 800; index += 6) {
    await Promise.all(entries.slice(index, index + 6).map(async ([state, id]) => {
      try {
        const { doc, race } = await loadGovernorById(state, id, deadline);
        if (isTrue(doc?.test_data)) testData = true;
        else races.push(race);
      } catch {
        // keep() conserva la versión anterior de esta gobernación.
      }
    }));
  }
  try {
    races.push(...await loadArizonaGovernor(deadline));
  } catch {
    // Arizona queda con su versión anterior, si la hay.
  }
  return { races, testData: testData && races.length === 0 };
}

async function loadChamber(office: 'senate' | 'house', id: string, deadline: number, searchAll: () => Promise<any[]>) {
  try {
    const doc = await requestJson(`race/${id}`, deadline);
    if (isTrue(doc?.test_data)) return { races: [], testData: true };
    const races = parseAggregate(doc, office);
    if (races.length >= MIN_RACES[office]) return { races, testData: false };
    throw new Error(`agregado incompleto (${races.length})`);
  } catch (error) {
    const races = fromSearch(await searchAll(), office);
    if (races.length) return { races, testData: false };
    throw error;
  }
}

/** Evita que una respuesta recortada reemplace una mejor. */
function keep(office: Office, loaded: { races: any[]; testData: boolean }) {
  const previous = memory[office];
  if (loaded.testData) {
    memory[office] = { races: [], fetchedAt: new Date().toISOString(), testData: true };
    return;
  }
  if (loaded.races.length < MIN_RACES[office]) throw new Error('respuesta sin contiendas');
  if (office === 'governor') {
    // Cada gobernación llega por separado: las que faltan conservan su último dato.
    const fresh = new Set(loaded.races.map((race) => race.id));
    const races = [...loaded.races, ...(previous?.races ?? []).filter((race) => !fresh.has(race.id))];
    memory[office] = { races, fetchedAt: new Date().toISOString(), testData: false };
    return;
  }
  if (previous && loaded.races.length < previous.races.length * 0.6) throw new Error(`respuesta recortada (${loaded.races.length} de ${previous.races.length})`);
  memory[office] = { races: loaded.races, fetchedAt: new Date().toISOString(), testData: false };
}

async function buildSnapshot(offices: readonly Office[]) {
  const deadline = Date.now() + CYCLE_BUDGET_MS;
  let everything: Promise<any[]> | null = null;
  const searchAll = () => {
    if (!everything) {
      const params = dateParams();
      params.set('limit', '5000');
      everything = requestJson(`race/search?${params}`, deadline).then(searchList);
    }
    return everything;
  };

  const loaders: Record<Office, () => Promise<{ races: any[]; testData: boolean }>> = {
    senate: () => loadChamber('senate', SENATE_AGGREGATE_ID, deadline, searchAll),
    house: () => loadChamber('house', HOUSE_AGGREGATE_ID, deadline, searchAll),
    governor: () => loadGovernors(deadline),
  };

  const sources: Record<string, any> = {};
  await Promise.all(offices.map(async (office) => {
    try {
      keep(office, await loaders[office]());
      sources[office] = { ok: true };
    } catch (error) {
      sources[office] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    sources[office].races = memory[office]?.races.length ?? 0;
    sources[office].fetchedAt = memory[office]?.fetchedAt ?? null;
  }));

  const stored = offices.map((office) => memory[office]).filter(Boolean) as Stored[];
  const races = stored.flatMap((source) => source.races);
  const body = {
    ok: stored.length > 0,
    source: 'civicAPI',
    fetchedAt: new Date().toISOString(),
    stale: Object.values(sources).some((source) => !source.ok),
    testData: races.length === 0 && stored.some((source) => source.testData),
    sources,
    races,
  };
  if (body.ok) lastSnapshots.set(offices.join(','), { at: Date.now(), body });
  return body;
}

const json = (body: unknown, status: number, cacheControl: string) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
  },
});

async function passThrough(path: string, cacheControl: string) {
  try {
    const { status, body, contentType } = await request(path, Date.now() + CYCLE_BUDGET_MS);
    return new Response(body, {
      status,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Cache-Control': status < 400 ? cacheControl : 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return json({ ok: false, error: 'civicAPI no respondió' }, 502, 'no-store');
  }
}

export async function GET({ url }: { url: URL }) {
  const id = url.searchParams.get('id');
  const query = url.searchParams.get('query');
  const state = url.searchParams.get('state');

  if (id) {
    if (!/^\d+$/.test(id)) return json({ ok: false, error: 'id inválido' }, 400, 'no-store');
    return passThrough(`race/${id}`, 'public, s-maxage=60, stale-while-revalidate=300');
  }

  if (query || state) {
    const params = dateParams();
    params.set('limit', '5000');
    if (query) params.set('query', query);
    if (state) params.set('province', state);
    return passThrough(`race/search?${params}`, 'public, s-maxage=60, stale-while-revalidate=300');
  }

  const part = url.searchParams.get('part');
  if (part && !OFFICES.includes(part as Office)) return json({ ok: false, error: 'parte inválida' }, 400, 'no-store');
  const offices: readonly Office[] = part ? [part as Office] : OFFICES;
  const key = offices.join(',');

  const recent = lastSnapshots.get(key);
  if (recent && Date.now() - recent.at < MEMORY_REUSE_MS) {
    return json(recent.body, 200, 'public, s-maxage=15, stale-while-revalidate=300, stale-if-error=3600');
  }

  let cycle = cyclesInFlight.get(key);
  if (!cycle) {
    cycle = buildSnapshot(offices).finally(() => cyclesInFlight.delete(key));
    cyclesInFlight.set(key, cycle);
  }
  const snapshot = await cycle;
  if (!snapshot.ok) return json(snapshot, 503, 'no-store');
  return json(snapshot, 200, `public, s-maxage=${snapshot.stale ? 10 : part === 'governor' ? 60 : 30}, stale-while-revalidate=300, stale-if-error=3600`);
}
