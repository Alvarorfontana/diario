import rss from '@astrojs/rss';
import { SECCIONES, SITE_TITLE } from '../../../consts';
import { getArticulos } from '../../../lib/articles';

export const prerender = false;

// RSS de una sola sección: /seccion/economia/rss.xml, /seccion/argentina/rss.xml, etc.
// Lo usan agregadores, lectores de noticias y otros medios para levantar las notas.
export async function GET(context) {
	const seccion = SECCIONES.find((s) => s.id === context.params.section);
	if (!seccion) return new Response('Sección inexistente', { status: 404 });

	const articulos = (await getArticulos()).filter((a) => a.section === seccion.id).slice(0, 50);

	return rss({
		title: `${SITE_TITLE} | ${seccion.nombre}`,
		description: `Las últimas noticias de ${seccion.nombre} en ${SITE_TITLE}.`,
		site: context.site,
		items: articulos.map((articulo) => ({
			title: articulo.title,
			description: articulo.excerpt,
			pubDate: articulo.date,
			categories: [seccion.nombre],
			link: `/articulo/${articulo.slug}/`,
		})),
	});
}
