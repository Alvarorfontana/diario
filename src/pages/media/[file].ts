// Fotos subidas desde el panel, servidas desde el repositorio de datos privado.
// Se publican al instante (no esperan un despliegue) y la CDN de Vercel las guarda en caché.
export const prerender = false;

import { getRuntimeEnv } from '../../lib/runtimeEnv';
import { readBinary } from '../../lib/datastore';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };

export const GET = async ({ params, locals }: any) => {
	const file = String(params.file || '');
	const ext = file.split('.').pop()?.toLowerCase() || '';
	if (!/^[a-z0-9._-]{3,120}$/i.test(file) || file.includes('..') || !TYPES[ext]) return new Response('No encontrado', { status: 404 });
	const env = getRuntimeEnv(locals);
	if (!env.GITHUB_PAT) return new Response('Sin configurar', { status: 500 });
	try {
		const bytes = await readBinary(`uploads/${file}`, env.GITHUB_PAT, env);
		if (!bytes) return new Response('No encontrado', { status: 404 });
		return new Response(bytes, {
			headers: {
				'content-type': TYPES[ext],
				// el nombre lleva la fecha: nunca cambia, se puede guardar un año
				'cache-control': 'public, max-age=31536000, immutable',
				'cdn-cache-control': 'public, max-age=31536000, immutable',
			},
		});
	} catch {
		return new Response('No disponible', { status: 502 });
	}
};
