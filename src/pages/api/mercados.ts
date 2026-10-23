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

export const GET = async () => {
	const [dolares, riesgo, euro] = await Promise.all([
		traer('https://dolarapi.com/v1/dolares'),
		traer('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo'),
		traer('https://dolarapi.com/v1/cotizaciones/eur'),
	]);

	const items: { nombre: string; valor: string; detalle?: string }[] = [];
	if (Array.isArray(dolares)) {
		for (const casa of Object.keys(CASAS)) {
			const d = dolares.find((x: any) => x?.casa === casa);
			if (d && typeof d.venta === 'number') {
				items.push({ nombre: CASAS[casa], valor: `$${d.venta.toLocaleString('es-AR')}`, detalle: 'venta' });
			}
		}
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
