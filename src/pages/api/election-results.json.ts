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
 * Con ?id= sigue entregando el detalle de una contienda; con ?query= o ?state=, la búsqueda.
 */
const API_BASE = (process.env.CIVICAPI_BASE_URL || 'https://civicapi.org/api/v2').replace(/\/+$/, '');
const SENATE_AGGREGATE_ID = '87528';
const HOUSE_AGGREGATE_ID = '87524';
const ELECTION_DATE = '2026-11-03';
const USER_AGENT = 'DiarioFederal/1.0 (+https://www.diariofederal.com.ar/elecciones-eeuu/)';

const CYCLE_BUDGET_MS = 8500;
const ATTEMPT_TIMEOUT_MS = 5500;
const MEMORY_REUSE_MS = 20000;
const MIN_RACES = { senate: 20, house: 300, governor: 1 };
const PLACEHOLDER = /^(write[- ]?ins?|scattering|other|others|blank|void|none of these)\b/i;

type Office = keyof typeof MIN_RACES;
type Stored = { races: any[]; fetchedAt: string; testData: boolean };

// Última versión buena de cada fuente mientras dure esta instancia del servidor.
const memory: Record<Office, Stored | null> = { senate: null, house: null, governor: null };
let lastSnapshot: { at: number; body: any } | null = null;
let cycleInFlight: Promise<any> | null = null;

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

async function loadGovernors(deadline: number, searchAll: () => Promise<any[]>) {
  const params = dateParams();
  params.set('query', 'Governor');
  params.set('limit', '200');
  let found = searchList(await requestJson(`race/search?${params}`, deadline)).filter((race) => classify(race) === 'governor');
  if (!found.length) found = (await searchAll()).filter((race) => classify(race) === 'governor');
  await fillCandidates(found, deadline);
  return { races: fromSearch(found, 'governor'), testData: found.length > 0 && found.every((race) => isTrue(race?.test_data)) };
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
  if (previous && loaded.races.length < previous.races.length * 0.6) throw new Error(`respuesta recortada (${loaded.races.length} de ${previous.races.length})`);
  memory[office] = { races: loaded.races, fetchedAt: new Date().toISOString(), testData: false };
}

async function buildSnapshot() {
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

  const loaders: Array<[Office, () => Promise<{ races: any[]; testData: boolean }>]> = [
    ['senate', () => loadChamber('senate', SENATE_AGGREGATE_ID, deadline, searchAll)],
    ['house', () => loadChamber('house', HOUSE_AGGREGATE_ID, deadline, searchAll)],
    ['governor', () => loadGovernors(deadline, searchAll)],
  ];

  const sources: Record<string, any> = {};
  await Promise.all(loaders.map(async ([office, load]) => {
    try {
      keep(office, await load());
      sources[office] = { ok: true };
    } catch (error) {
      sources[office] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    sources[office].races = memory[office]?.races.length ?? 0;
    sources[office].fetchedAt = memory[office]?.fetchedAt ?? null;
  }));

  const stored = Object.values(memory).filter(Boolean) as Stored[];
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
  if (body.ok) lastSnapshot = { at: Date.now(), body };
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

  if (lastSnapshot && Date.now() - lastSnapshot.at < MEMORY_REUSE_MS) {
    return json(lastSnapshot.body, 200, 'public, s-maxage=15, stale-while-revalidate=300, stale-if-error=3600');
  }

  cycleInFlight ??= buildSnapshot().finally(() => { cycleInFlight = null; });
  const snapshot = await cycleInFlight;
  if (!snapshot.ok) return json(snapshot, 503, 'no-store');
  return json(snapshot, 200, `public, s-maxage=${snapshot.stale ? 10 : 30}, stale-while-revalidate=300, stale-if-error=3600`);
}
