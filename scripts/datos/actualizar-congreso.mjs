// Monitor del Congreso: actualiza data/laboratorio/congreso.json con los datos abiertos de la Cámara de Diputados.
// Lo corre el robot .github/workflows/congreso-datos.yml dos veces por semana. Sin dependencias (Node 20).
//
// Qué recalcula: composición de Diputados, proyectos como autor principal (por tipo), aprobados en una o en
// las dos cámaras, últimos proyectos y comisiones. Lo que todavía no recalcula (Senado, viajes, misiones,
// serie histórica) lo conserva del archivo anterior. Si algo sale raro, no escribe nada y deja el archivo como estaba.
import { readFileSync, writeFileSync } from 'node:fs';

const ARCHIVO = 'data/laboratorio/congreso.json';
const API = 'https://datos.hcdn.gob.ar/api/3/action/package_show?id=';
const DESDE = '2024-01-01';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titulo = (s) => String(s ?? '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

async function pedir(url, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'DiarioFederal-Laboratorio/1.0' }, signal: AbortSignal.timeout(180_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) { ultimo = e; await new Promise((ok) => setTimeout(ok, 5000 * (i + 1))); }
  }
  throw new Error(`${url}: ${ultimo?.message}`);
}

// CSV con comillas, comas y saltos de línea dentro de los campos
function csv(texto) {
  const filas = []; let fila = [], campo = '', q = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (q) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = (filas.shift() || []).map((h) => h.replace(/^﻿/, '').trim().toUpperCase());
  return filas.filter((f) => f.length > 1).map((f) => Object.fromEntries(cab.map((h, i) => [h, (f[i] ?? '').trim()])));
}

async function recurso(paquete, nombre) {
  const p = (await (await pedir(API + paquete)).json()).result;
  const r = p.resources.find((x) => norm(x.name) === norm(nombre)) || (nombre ? null : p.resources.find((x) => /csv/i.test(x.format)));
  if (!r) throw new Error(`No encontré "${nombre}" en ${paquete}. Hay: ${p.resources.map((x) => x.name).join(' | ')}`);
  const buf = Buffer.from(await (await pedir(r.url)).arrayBuffer());
  let texto = buf.toString('utf8');
  if (texto.includes('�')) texto = buf.toString('latin1');
  return csv(texto);
}

// Etapa más avanzada de un proyecto según el texto del movimiento
function etapa(mov) {
  const m = norm(mov);
  if (/\bal archivo\b/.test(m)) return null;
  if (/sancion definitiva|^(continua )?consideracion y sancion|^sancion\b|insistencia|promulgacion|observa totalmente|veto/.test(m)) return 'sa';
  if (/^(continua )?consideracion y aprobacion|^aprobacion articulo (114|106)|^(pasa|vuelve) a (senado|diputados)|media sancion/.test(m)) return 'me';
  return null;
}
const RANGO = { null: 0, me: 1, sa: 2 };

const previo = JSON.parse(readFileSync(ARCHIVO, 'utf8'));
const prevPorId = new Map(previo.filas.map((f) => [f.id, f]));
const prevPorNombre = new Map(previo.filas.filter((f) => f.c === 'D').map((f) => [norm(f.n), f]));

// 1. Composición actual
const comp = await recurso('legisladores', 'Composición Actual de la Cámara');
const dip = comp.map((r) => ({
  id: 'dip-' + slug(`${r.APELLIDO} ${r.NOMBRE} ${r.DISTRITO}`),
  clave: norm(`${r.APELLIDO}, ${r.NOMBRE}`),
  n: `${titulo(r.APELLIDO)}, ${r.NOMBRE}`,
  p: titulo(r.DISTRITO), b: (r.BLOQUE || '').trim() || 'SIN BLOQUE', m: r.MANDATO, j: r.FECHA_DE_JURA,
}));
if (dip.length < 250) throw new Error(`Composición con ${dip.length} diputados: no se actualiza.`);
const porClave = new Map(dip.map((d) => [d.clave, d]));

// 2. Proyectos y movimientos
const proyectos = (await recurso('proyectos-parlamentarios', 'Proyectos Parlamentarios'))
  .filter((p) => (p.PUBLICACION_FECHA || '').slice(0, 10) >= DESDE);
const ids = new Set(proyectos.map((p) => p.PROYECTO_ID));
const mejor = new Map();
for (const m of await recurso('movimientos-de-proyectos', 'Movimientos de proyectos')) {
  if (!ids.has(m.PROYECTO_ID)) continue;
  const e = etapa(m.MOVIMIENTO);
  if (RANGO[e] > RANGO[mejor.get(m.PROYECTO_ID) ?? null]) mejor.set(m.PROYECTO_ID, e);
}
const acum = new Map(); let emparejados = 0, deDiputados = 0, hasta = DESDE;
for (const p of proyectos) {
  const fecha = (p.PUBLICACION_FECHA || '').slice(0, 10);
  if (fecha > hasta) hasta = fecha;
  const autor = norm(String(p.AUTOR || '').replace(/^(dip\.|sen\.)\s*/i, ''));
  if (p.CAMARA_ORIGEN !== 'Senado') deDiputados++;
  const d = porClave.get(autor);
  if (!d) continue;
  emparejados++;
  const a = acum.get(d.id) || { t: 0, l: 0, r: 0, d: 0, me: 0, sa: 0, rec: [] };
  a.t++;
  const tipo = norm(p.TIPO);
  if (tipo === 'ley') a.l++; else if (tipo === 'resolucion') a.r++; else if (tipo === 'declaracion') a.d++;
  const e = mejor.get(p.PROYECTO_ID); if (e) a[e]++;
  const exp = p.CAMARA_ORIGEN === 'Senado' ? (p.EXP_SENADO || p.EXP_DIPUTADOS) : (p.EXP_DIPUTADOS || p.EXP_SENADO);
  a.rec.push({ t: (p.TITULO || '').replace(/\s+/g, ' ').toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase()), f: fecha, tp: titulo(p.TIPO), x: exp || '' });
  acum.set(d.id, a);
}
if (deDiputados && emparejados / deDiputados < 0.4) throw new Error(`Solo ${emparejados} de ${deDiputados} proyectos emparejados con diputados actuales: no se actualiza.`);

// 3. Comisiones
let comisiones = null;
try {
  const nombres = new Map((await recurso('comisiones', 'Comisiones')).map((c) => [c.ID, titulo(c.NOMBRE)]));
  const porDip = new Map();
  const agregar = (filas, cargoDe) => filas.forEach((f) => {
    const d = porClave.get(norm(f.DIPUTADO_NOMBRE)); if (!d) return;
    const lista = porDip.get(d.id) || new Map();
    const cargo = cargoDe(f); const ant = lista.get(f.COMISION_ID);
    if (!ant || ant === 'integrante') lista.set(f.COMISION_ID, cargo);
    porDip.set(d.id, lista);
  });
  agregar(await recurso('comisiones', 'Comisiones Permanentes - integrantes'), () => 'integrante');
  agregar(await recurso('comisiones', 'Comisiones Permanentes Autoridades'), (f) => norm(f.CARGO) || 'integrante');
  comisiones = new Map([...porDip].map(([id, m]) => [id, [...m].map(([cid, cargo]) => ({ comision: nombres.get(cid) || cid, cargo }))]));
} catch (e) { console.log('Comisiones: se conservan las anteriores.', e.message); }

// 4. Armar las filas de Diputados, conservando lo que no se recalcula
const filasD = dip.map((d) => {
  const ant = prevPorId.get(d.id) || prevPorNombre.get(d.clave) || {};
  const a = acum.get(d.id) || { t: 0, l: 0, r: 0, d: 0, me: 0, sa: 0, rec: [] };
  const cl = comisiones ? (comisiones.get(d.id) || []) : (ant.cl || []);
  return {
    ...ant, id: d.id, c: 'D', n: d.n, p: d.p, b: d.b, m: d.m, j: d.j || ant.j,
    t: a.t, l: a.l, r: a.r, d: a.d, pl: a.t ? +(a.l / a.t).toFixed(4) : null,
    me: a.me, sa: a.sa, te: a.t ? +(a.sa / a.t).toFixed(4) : null,
    co: cl.length, pr: cl.filter((c) => c.cargo !== 'integrante').length, cl,
    rec: a.rec.sort((x, y) => y.f.localeCompare(x.f)).slice(0, 5),
  };
});
const salida = {
  ...previo,
  fecha: new Date().toISOString().slice(0, 10),
  periodo: { desde: DESDE, hasta },
  filas: [...filasD, ...previo.filas.filter((f) => f.c === 'S')],
};
writeFileSync(ARCHIVO, JSON.stringify(salida));
console.log(`Listo: ${filasD.length} diputados, ${emparejados} de ${deDiputados} proyectos emparejados, datos hasta ${hasta}.`);
