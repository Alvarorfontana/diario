export const prerender = false;

// Franja de mercados de la portada: dólar (DolarAPI) y riesgo país (ArgentinaDatos).
// Las dos fuentes son gratuitas. Vercel guarda la respuesta 10 minutos para no consultarlas en cada visita.

const CASAS: Record<string, string> = {
	oficial: 'Dólar oficial',
	blue: 'Dólar blue',
	bolsa: 'Dólar MEP',
	contadoconliqui: 'Dólar CCL',
	tarjeta: 'Dólar tarjeta',
};

async function traer(url: string) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 5000);
	try {
		const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

// Cotización de cierre del día hábil anterior (ArgentinaDatos, gratuita), para saber si el dólar sube o baja.
// Prueba hacia atrás hasta encontrar un día con dato (fines de semana y feriados no tienen).
function fechaAR(diasAtras: number) {
	const d = new Date(Date.now() - 3 * 3600 * 1000 - diasAtras * 86400 * 1000);
	return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}
async function ventaAnterior(casa: string): Promise<number | null> {
	for (let i = 1; i <= 6; i++) {
		const r = await traer(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}/${fechaAR(i)}`);
		const v = Array.isArray(r) ? r[0]?.venta : r?.venta;
		if (typeof v === 'number' && v > 0) return v;
	}
	return null;
}

export const GET = async () => {
	const [dolares, riesgo, euro] = await Promise.all([
		traer('https://dolarapi.com/v1/dolares'),
		traer('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo'),
		traer('https://dolarapi.com/v1/cotizaciones/eur'),
	]);

	const items: { nombre: string; valor: string; detalle?: string; variacion?: number }[] = [];
	if (Array.isArray(dolares)) {
		const casas = Object.keys(CASAS);
		const anteriores = await Promise.all(casas.map((c) => ventaAnterior(c)));
		casas.forEach((casa, i) => {
			const d = dolares.find((x: any) => x?.casa === casa);
			if (d && typeof d.venta === 'number') {
				const ant = anteriores[i];
				const item: (typeof items)[number] = { nombre: CASAS[casa], valor: `$${d.venta.toLocaleString('es-AR')}`, detalle: 'venta' };
				if (ant) item.variacion = Math.round(((d.venta - ant) / ant) * 10000) / 100;
				items.push(item);
			}
		});
	}
	if (euro && typeof euro.venta === 'number') {
		items.push({ nombre: 'Euro', valor: `$${euro.venta.toLocaleString('es-AR')}`, detalle: 'venta' });
	}
	if (riesgo && typeof riesgo.valor === 'number') {
		items.push({ nombre: 'Riesgo país', valor: `${riesgo.valor.toLocaleString('es-AR')}`, detalle: 'puntos' });
	}

	return new Response(JSON.stringify({ ok: items.length > 0, items }), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': items.length > 0 ? 'public, s-maxage=600, stale-while-revalidate=1800' : 'no-store',
		},
	});
};
