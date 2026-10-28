// Feed del podcast para Spotify, Apple Podcasts, YouTube Music, Pocket Casts, etc.
// Se arma al publicar el sitio (cada audio nuevo dispara un despliegue), así puede
// leer el tamaño real de cada mp3, que las plataformas piden.
import type { APIRoute } from 'astro';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { PODCAST, getEpisodios, hhmmss } from '../lib/podcast';
import { nombreSeccion } from '../consts';

export const prerender = true;

const esc = (s: string) =>
	String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

function tamano(archivo: string): number {
	try {
		return statSync(join(process.cwd(), 'public', archivo)).size;
	} catch {
		return 0;
	}
}

export const GET: APIRoute = async ({ site }) => {
	const origen = (site ?? new URL('https://www.diariofederal.com.ar')).origin;
	const abs = (p: string) => new URL(p, origen).href;
	const episodios = await getEpisodios();
	const ultima = episodios[0]?.articulo.date ?? new Date();

	const items = episodios
		.map(({ articulo: a, archivo, duracion }) => {
			const link = abs(`/articulo/${a.slug}/`);
			const texto = `${a.excerpt ?? ''}\n\nLeé la nota completa: ${link}`;
			return `
		<item>
			<title>${esc(a.title)}</title>
			<link>${esc(link)}</link>
			<guid isPermaLink="false">diariofederal-${esc(a.slug)}</guid>
			<pubDate>${a.date.toUTCString()}</pubDate>
			<description>${esc(texto)}</description>
			<itunes:summary>${esc(texto)}</itunes:summary>
			<itunes:author>${esc(a.author || PODCAST.autor)}</itunes:author>
			<category>${esc(nombreSeccion(a.section || ''))}</category>
			<enclosure url="${esc(abs(archivo))}" length="${tamano(archivo)}" type="audio/mpeg" />
			<itunes:duration>${hhmmss(duracion)}</itunes:duration>
			<itunes:episodeType>full</itunes:episodeType>
			<itunes:explicit>false</itunes:explicit>${a.image_url && a.image_url.startsWith('/') ? `
			<itunes:image href="${esc(abs(a.image_url))}" />` : ''}
		</item>`;
		})
		.join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
	<channel>
		<title>${esc(PODCAST.titulo)}</title>
		<link>${esc(abs('/escuchar/'))}</link>
		<atom:link href="${esc(abs('/podcast.xml'))}" rel="self" type="application/rss+xml" />
		<language>${PODCAST.idioma}</language>
		<copyright>© ${new Date().getFullYear()} ${esc(PODCAST.autor)}</copyright>
		<description>${esc(PODCAST.descripcion)}</description>
		<lastBuildDate>${ultima.toUTCString()}</lastBuildDate>
		<image>
			<url>${esc(abs(PODCAST.portada))}</url>
			<title>${esc(PODCAST.titulo)}</title>
			<link>${esc(abs('/escuchar/'))}</link>
		</image>
		<itunes:image href="${esc(abs(PODCAST.portada))}" />
		<itunes:author>${esc(PODCAST.autor)}</itunes:author>
		<itunes:summary>${esc(PODCAST.descripcion)}</itunes:summary>
		<itunes:owner>
			<itunes:name>${esc(PODCAST.autor)}</itunes:name>
			<itunes:email>${esc(PODCAST.email)}</itunes:email>
		</itunes:owner>
		<itunes:category text="${esc(PODCAST.categoria)}">
			<itunes:category text="${esc(PODCAST.subcategoria)}" />
		</itunes:category>
		<itunes:explicit>false</itunes:explicit>
		<itunes:type>episodic</itunes:type>
		<podcast:locked>no</podcast:locked>${items}
	</channel>
</rss>
`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
	});
};
