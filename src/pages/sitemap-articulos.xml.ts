export const prerender = false;
import type { APIRoute } from 'astro';
import { getArticulos } from '../lib/articles';
import { SECCIONES } from '../consts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Sitemap con TODAS las notas (las notas se generan al momento, por eso el sitemap automático de Astro no las incluye).
export const GET: APIRoute = async ({ site }) => {
	const base = (site ?? new URL('https://www.diariofederal.com.ar/')).origin;
	const arts = await getArticulos();
	const fijas = ['/', '/buscar/', '/about/', ...SECCIONES.map((s: any) => `/seccion/${s.id}/`)];

	const urls = [
		...fijas.map((p) => `<url><loc>${base}${p}</loc><changefreq>hourly</changefreq></url>`),
		...arts.map((a) => {
			const img = a.image_url ? `<image:image><image:loc>${esc(new URL(a.image_url, base).href)}</image:loc></image:image>` : '';
			return `<url><loc>${base}/articulo/${encodeURIComponent(a.slug)}/</loc><lastmod>${new Date(a.date).toISOString()}</lastmod>${img}</url>`;
		}),
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
};
