export const prerender = false;

import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { isAdmin } from '../../../lib/auth';

const FEEDS = [
  { name: 'BBC Mundo', url: 'https://feeds.bbci.co.uk/mundo/rss.xml', region: 'América Latina' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'Mundo' },
  { name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-en-all', region: 'Europa' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', region: 'Europa' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', region: 'Medio Oriente' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', region: 'Mundo' },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', region: 'Estados Unidos' },
  { name: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml', region: 'Europa' },
];

function clean(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return match ? clean(match[1]) : '';
}

function parseFeed(xml: string, source: typeof FEEDS[number]) {
  const blocks = xml.match(/<(?:item|entry)(?:\s[^>]*)?>[\s\S]*?<\/(?:item|entry)>/gi) || [];
  return blocks.slice(0, 12).map((block) => {
    const linkTag = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const linkText = tag(block, 'link');
    return {
      title: tag(block, 'title'),
      url: linkTag?.[1] || linkText,
      publishedAt: tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated'),
      summary: tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'),
      source: source.name,
      region: source.region,
      type: 'RSS',
    };
  }).filter((item) => item.title && /^https?:\/\//i.test(item.url));
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getRuntimeEnv(locals);
  if (!(await isAdmin(request, env))) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || 'world').trim().slice(0, 180);
  const mode = url.searchParams.get('mode') || 'all';
  const tasks: Promise<any>[] = [];

  if (mode === 'all' || mode === 'rss') {
    for (const feed of FEEDS) {
      tasks.push((async () => {
        try {
          const response = await fetch(feed.url, {
            headers: { 'User-Agent': 'DiarioFederal-Radar/1.0 (editorial research)' },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const xml = await response.text();
          return { source: feed.name, items: parseFeed(xml, feed), ok: true };
        } catch (error) {
          return { source: feed.name, items: [], ok: false, error: error instanceof Error ? error.message : 'Error de conexión' };
        }
      })());
    }
  }

  if (mode === 'all' || mode === 'gdelt') {
    tasks.push((async () => {
      try {
        const endpoint = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
        endpoint.searchParams.set('query', query);
        endpoint.searchParams.set('mode', 'ArtList');
        endpoint.searchParams.set('format', 'json');
        endpoint.searchParams.set('maxrecords', '30');
        endpoint.searchParams.set('sort', 'DateDesc');
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const items = (data.articles || []).map((article: any) => ({
          title: article.title || '',
          url: article.url || '',
          publishedAt: article.seendate || '',
          summary: article.domain ? 'Publicado por ' + article.domain + (article.language ? ' · ' + article.language : '') : '',
          source: article.domain || 'GDELT',
          region: article.sourcecountry || 'Internacional',
          type: 'GDELT',
        })).filter((item: any) => item.title && /^https?:\/\//i.test(item.url));
        return { source: 'GDELT', items, ok: true };
      } catch (error) {
        return { source: 'GDELT', items: [], ok: false, error: error instanceof Error ? error.message : 'Error de conexión' };
      }
    })());
  }

  const results = await Promise.all(tasks);
  const items = results.flatMap((result) => result.items)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .slice(0, 100);
  return new Response(JSON.stringify({
    query, generatedAt: new Date().toISOString(),
    sources: results.map(({ source, ok, error, items }) => ({ source, ok, error, count: items.length })),
    items,
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
};
