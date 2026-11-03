export const prerender = false;

// Datos de mercado para la franja de Diario Federal.
// Divisas e índices: MonedAPI (actualización publicada cada 5 minutos).
// ADRs: Yahoo Finance chart, con precio de rueda y cierre previo.
// Se informa siempre la hora de mercado; no se simula tiempo real.

const FX = [
  ['Dólar oficial', 'usd/oficial', 'venta'],
  ['Dólar blue', 'usd/blue', 'venta'],
  ['Dólar MEP', 'usd/bolsa', 'venta'],
  ['Dólar CCL', 'usd/ccl', 'venta'],
  ['Dólar tarjeta', 'usd/tarjeta', 'venta'],
  ['Euro', 'eur/bna', 'venta'],
  ['Riesgo país', 'arg/riesgo', 'puntos'],
] as const;

const ADRS = [
  ['YPF', 'YPF'], ['Grupo Financiero Galicia', 'GGAL'],
  ['Banco Macro', 'BMA'], ['BBVA Argentina', 'BBAR'],
  ['Grupo Supervielle', 'SUPV'], ['Pampa Energía', 'PAM'],
  ['Vista Energy', 'VIST'], ['Transportadora de Gas del Sur', 'TGS'],
  ['Edenor', 'EDN'], ['Cresud', 'CRESY'], ['IRSA', 'IRS'],
  ['Telecom Argentina', 'TEO'], ['Loma Negra', 'LOMA'],
] as const;

async function traer(url: string, timeout = 6500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json', 'user-agent': 'DiarioFederal/1.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const money = (n: number) => '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export const GET = async () => {
  const [fxResults, adrResults] = await Promise.all([
    Promise.all(FX.map(async ([nombre, path, detalle]) => {
      const d: any = await traer(`https://monedapi.ar/api/v2/${path}`);
      if (!d || typeof d.sell !== 'number') return null;
      return {
        nombre, valor: detalle === 'puntos' ? d.sell.toLocaleString('es-AR') : money(d.sell),
        detalle, updatedAt: d.updatedAt ?? null, source: 'MonedAPI',
      };
    })),
    Promise.all(ADRS.map(async ([nombre, symbol]) => {
      const d: any = await traer(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`);
      const q = d?.chart?.result?.[0];
      const meta = q?.meta;
      const price = meta?.regularMarketPrice;
      const previous = meta?.chartPreviousClose ?? meta?.previousClose;
      if (typeof price !== 'number' || typeof previous !== 'number' || !previous) return null;
      const change = ((price - previous) / previous) * 100;
      return {
        nombre, ticker: symbol, valor: price.toLocaleString('en-US', { style: 'currency', currency: meta.currency || 'USD' }),
        change: Number(change.toFixed(2)), changeLabel: `${change > 0 ? '+' : ''}${change.toFixed(2)}%`,
        marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
        source: 'Yahoo Finance',
      };
    })),
  ]);

  const items = fxResults.filter(Boolean);
  const adrs = adrResults.filter(Boolean);
  const updatedAt = new Date().toISOString();

  return new Response(JSON.stringify({
    ok: items.length > 0, items, adrs, updatedAt,
    marketNote: 'Las ADRs reflejan la última cotización disponible de la rueda estadounidense; pueden tener demora.',
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
};
