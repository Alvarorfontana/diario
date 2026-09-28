import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getRuntimeEnv } from '../lib/runtimeEnv';

export const prerender = false;

export async function GET(context) {
	const env = getRuntimeEnv(context.locals);
	const supabaseUrl = env.SUPABASE_PROJECT_URL;
	const supabaseKey = env.SUPABASE_SECRET_KEY;

	const res = await fetch(
		`${supabaseUrl}/rest/v1/articles?select=*&order=date.desc`,
		{
			headers: {
				apikey: supabaseKey,
				Authorization: `Bearer ${supabaseKey}`,
			},
		}
	);

	const articulos = res.ok ? await res.json() : [];

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: articulos.map((articulo) => ({
			title: articulo.title,
			description: articulo.excerpt,
			pubDate: new Date(articulo.date),
			categories: articulo.section ? [articulo.section] : [],
			link: `/articulo/${articulo.slug}/`,
		})),
	});
}
