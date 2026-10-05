export const prerender = false;
import type { APIRoute } from 'astro';
import { getArticulos } from '../lib/articles';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

// Resumen del sitio en texto simple para asistentes de IA.
export const GET: APIRoute = async ({ site }) => {
	const base = (site ?? new URL('https://www.diariofederal.com.ar/')).origin;
	const arts = (await getArticulos()).slice(0, 40);
	const lineas = [
		`# ${SITE_TITLE}`,
		'',
		`> ${SITE_DESCRIPTION} Medio de noticias de Argentina en español (${base}).`,
		'',
		'## Últimas notas',
		...arts.map((a) => `- [${a.title}](${base}/articulo/${encodeURIComponent(a.slug)}/): ${a.excerpt}`),
		'',
		'## Más información',
		`- [Mapa del sitio](${base}/sitemap-articulos.xml)`,
		`- [RSS](${base}/rss.xml)`,
	];
	return new Response(lineas.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } });
};
