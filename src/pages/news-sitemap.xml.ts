export const prerender = false;
import type { APIRoute } from 'astro';
import { getArticulos } from '../lib/articles';
import { SITE_TITLE } from '../consts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Sitemap de Google News: solo notas de los últimos 2 días (así lo exige el formato).
export const GET: APIRoute = async ({ site }) => {
	const base = (site ?? new URL('https://www.diariofederal.com.ar/')).origin;
	const desde = Date.now() - 2 * 24 * 60 * 60 * 1000;
	const recientes = (await getArticulos()).filter((a) => new Date(a.date).getTime() >= desde).slice(0, 1000);

	const urls = recientes.map(
		(a) => `<url><loc>${base}/articulo/${encodeURIComponent(a.slug)}/</loc><news:news><news:publication><news:name>${esc(SITE_TITLE)}</news:name><news:language>es</news:language></news:publication><news:publication_date>${new Date(a.date).toISOString()}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`
	);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join('\n')}\n</urlset>`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
};
