import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const articulos = await getCollection('articulos');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: articulos.map((articulo) => ({
			title: articulo.data.title,
			description: articulo.data.description,
			pubDate: articulo.data.pubDate,
			categories: [articulo.data.section],
			link: `/articulo/${articulo.id}/`,
		})),
	});
}
