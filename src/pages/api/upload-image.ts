export const prerender = false;

import { isAdmin } from '../../lib/auth';
import { getRuntimeEnv } from '../../lib/runtimeEnv';
import { getRepo } from '../../lib/repo';
import { getDataRepo, writeData } from '../../lib/datastore';
import { optimizarSubida } from '../../lib/imagenes';

const UPLOAD_DIR = 'public/uploads';
const MAX_BYTES = 3_000_000;

type RuntimeEnv = Record<string, string | undefined>;
interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export const POST = async ({ request, locals }: ApiContext) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) {
		return json({ ok: false, error: 'No autorizado' }, 401);
	}
	const REPO = env.GITHUB_REPO || getRepo().repo;
	const BRANCH = env.GITHUB_BRANCH || getRepo().branch;
	const token = env.GITHUB_PAT;
	if (!token) return json({ ok: false, error: 'GITHUB_PAT no configurado' }, 500);

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) return json({ ok: false, error: 'No llegó ningún archivo' }, 400);
		if (!file.type.startsWith('image/')) return json({ ok: false, error: 'El archivo no es una imagen' }, 400);
		if (file.size > MAX_BYTES) return json({ ok: false, error: 'La imagen pesa demasiado (máx. 3 MB)' }, 400);

		// Fotos: se achican a 1600 px y se guardan en JPG (~200-400 KB). Así cargan rápido en el
		// celular y WhatsApp no descarta la vista previa por peso. GIF y SVG quedan como vienen.
		let bytes = new Uint8Array(await file.arrayBuffer());
		let ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
		const optimizada = await optimizarSubida(bytes, file.type);
		if (optimizada) {
			bytes = optimizada;
			ext = 'jpg';
		}
		const base =
			file.name
				.replace(/\.[^.]+$/, '')
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 50) || 'imagen';
		const fileName = `${Date.now()}-${base}.${ext}`;
		const path = `${UPLOAD_DIR}/${fileName}`;

		// Con repo de datos privado: la foto va ahí y se sirve al instante por /media/,
		// sin disparar un despliegue del sitio ni esperar a que se publique.
		if (getDataRepo(env).separate) {
			await writeData(`uploads/${fileName}`, toBase64(bytes), null, `Subir imagen: ${fileName}`, token, env, true);
			return json({ ok: true, url: `/media/${fileName}` });
		}
		const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
			method: 'PUT',
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github+json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message: `Subir imagen: ${fileName}`,
				content: toBase64(bytes),
				branch: BRANCH,
			}),
		});
		const result = await res.json();
		if (!res.ok) {
			return json({ ok: false, error: 'GitHub API error', detail: result.message }, 500);
		}
		return json({ ok: true, url: `/uploads/${fileName}` });
	} catch (e) {
		return json({ ok: false, error: 'No se pudo subir la imagen' }, 500);
	}
};
