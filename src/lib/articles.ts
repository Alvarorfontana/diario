import { getCollection } from 'astro:content';

export interface Articulo {
	id: string;
	slug: string;
	title: string;
	volanta?: string;
	excerpt: string;
	section: string;
	author: string;
	date: Date;
	image_url: string;
	imageCaption?: string;
	tags: string[];
	breaking: boolean;
	entry: any;
}

// El slug es el nombre del archivo (sin extensión): así coincide con lo que usa el panel.
function slugDe(entry: any): string {
	const file = String(entry.filePath ?? entry.id).split('/').pop() ?? entry.id;
	return file.replace(/\.(md|mdx)$/, '');
}

function imagen(h: any): string {
	if (!h) return '';
	return typeof h === 'string' ? h : (h.src ?? '');
}

export async function getArticulos(): Promise<Articulo[]> {
	const todos = await getCollection('articulos', ({ data }: any) => !data.draft);
	return todos
		.map((entry: any) => {
			const d = entry.data;
			const slug = slugDe(entry);
			return {
				id: slug,
				slug,
				title: d.title,
				volanta: d.volanta,
				excerpt: d.description,
				section: d.section,
				author: d.author,
				date: d.pubDate as Date,
				image_url: imagen(d.heroImage),
				imageCaption: d.imageCaption,
				tags: d.tags ?? [],
				breaking: d.ultimoMomento === true,
				entry,
			};
		})
		.sort((a: Articulo, b: Articulo) => b.date.valueOf() - a.date.valueOf());
}

export async function getArticulo(slug: string): Promise<Articulo | undefined> {
	return (await getArticulos()).find((a) => a.slug === slug);
}
