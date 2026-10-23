import { getCollection } from 'astro:content';
import { deducirRegion, type RegionId } from './regiones';

export interface Articulo {
	id: string;
	slug: string;
	title: string;
	volanta?: string;
	excerpt: string;
	section: string;
	author: string;
	ciudad?: string;
	// Región de la nota (elegida en el panel o deducida). undefined = nacional.
	region?: RegionId;
	date: Date;
	image_url: string;
	imageCaption?: string;
	tags: string[];
	puntosClave: string[];
	resumenCompartir?: string;
	correccion?: string;
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
				ciudad: d.ciudad?.trim() || undefined,
				// Internacionales nunca se deducen (La Rioja de España, Santa Cruz de Bolivia...):
				// solo entran a una región si se elige a mano en el panel.
				region:
					d.region === 'nacional'
						? undefined
						: d.region ?? (d.section === 'internacional' ? undefined : deducirRegion([d.volanta, d.title, d.description, d.ciudad, ...(d.tags ?? [])].filter(Boolean).join(' . '))),
				date: d.pubDate as Date,
				image_url: imagen(d.heroImage),
				imageCaption: d.imageCaption,
				tags: d.tags ?? [],
				puntosClave: (d.puntosClave ?? []).filter(Boolean).slice(0, 3),
				resumenCompartir: d.resumenCompartir?.trim() || undefined,
				correccion: d.correccion?.trim() || undefined,
				breaking: d.ultimoMomento === true,
				entry,
			};
		})
		.sort((a: Articulo, b: Articulo) => b.date.valueOf() - a.date.valueOf());
}

export async function getArticulo(slug: string): Promise<Articulo | undefined> {
	return (await getArticulos()).find((a) => a.slug === slug);
}
