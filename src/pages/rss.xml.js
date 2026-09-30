import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getArticulos } from '../lib/articles';

export const prerender = false;

export async function GET(context) {
	const articulos = await getArticulos();

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: articulos.map((articulo) => ({
			title: articulo.title,
			description: articulo.excerpt,
			pubDate: articulo.date,
			categories: articulo.section ? [articulo.section] : [],
			link: `/articulo/${articulo.slug}/`,
		})),
	});
}
