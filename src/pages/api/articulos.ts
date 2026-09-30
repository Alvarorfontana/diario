export const prerender = false;
import { getArticulos } from '../../lib/articles';

// Lista pública de notas publicadas (la usa el buscador).
export const GET = async () => {
	const lista = (await getArticulos()).map((a) => ({
		slug: a.slug,
		title: a.title,
		excerpt: a.excerpt,
		section: a.section,
		date: a.date,
	}));
	return new Response(JSON.stringify(lista), { headers: { 'content-type': 'application/json' } });
};
