import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SECCIONES } from './consts';

const articulos = defineCollection({
	// Carga los artículos en Markdown/MDX desde src/content/articulos/
	loader: glob({ base: './src/content/articulos', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			volanta: z.string().optional(),
			description: z.string(),
			section: z.enum(SECCIONES.map((s) => s.id) as [string, ...string[]]),
			author: z.string().default('Redacción'),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),

			// Rutas públicas (/uploads/...) y URLs externas se usan tal cual;
			// solo las rutas relativas del repo pasan por image()
			heroImage: z
				.union([
					z.string().regex(/^(\/|https?:\/\/)/),
					image(),
				])
				.optional(),

			// Pie de foto (epígrafe) que acompaña a la imagen principal
			imageCaption: z.string().optional(),

			// Borrador: se guarda pero no se muestra en el sitio
			draft: z.boolean().default(false),

			// Marca la noticia como alerta de último momento en la portada
			ultimoMomento: z.boolean().optional(),

			// Etiquetas temáticas
			tags: z.array(z.string()).default([]),
		}),
});

export const collections = { articulos };
