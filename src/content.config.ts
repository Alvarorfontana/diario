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
			// Ciudad desde donde escribe el corresponsal: se muestra en la firma ("Por X (Corrientes)")
			ciudad: z.string().optional(),
			// Región para la portada regional. Si falta, se deduce sola (ver src/lib/regiones.ts)
			region: z.enum(['norte-grande', 'centro', 'cuyo', 'patagonia', 'buenos-aires', 'nacional']).optional(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// Rutas públicas (/uploads/...) y URLs externas se usan tal cual; solo las rutas relativas del repo pasan por image()
			heroImage: z.union([z.string().regex(/^(\/|https?:\/\/)/), image()]).optional(),
			// Pie de foto (epígrafe) que acompaña a la imagen principal
			imageCaption: z.string().optional(),
			// Borrador: se guarda pero no se muestra en el sitio
			draft: z.boolean().default(false),
			// Marca la noticia como alerta de último momento en la portada
			ultimoMomento: z.boolean().optional(),
			// Etiquetas temáticas (p. ej. ['Clima', 'Economía'])
			tags: z.array(z.string()).default([]),
			// "Lo que tenés que saber": hasta 3 puntos de resumen que se muestran al principio de la nota
			puntosClave: z.array(z.string()).default([]),
			// Resumen de un renglón para la tarjeta de WhatsApp y redes (si falta, se usa la bajada)
			resumenCompartir: z.string().optional(),
			// Fe de erratas: si se corrige algo de la nota, se explica acá y se muestra al pie
			correccion: z.string().optional(),
		}),
});

export const collections = { articulos };
