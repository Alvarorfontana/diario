export const prerender = false;

import { parse, stringify } from 'yaml';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { isAdmin } from '../../../lib/auth';
import { ghConfig, listDir, getFile, putFile, deleteFile, NOTAS_DIR } from '../../../lib/github';
import { mdToHtml, htmlParaArchivo } from '../../../lib/md';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function splitFrontmatter(raw: string): { data: Record<string, any>; body: string } {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: raw };
	let data: Record<string, any> = {};
	try { data = parse(m[1]) ?? {}; } catch { /* frontmatter roto: se muestra vacío */ }
	return { data, body: m[2] };
}

const fechaISO = (v: any) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10);

async function guard(request: Request, locals: any) {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return { error: json({ ok: false, error: 'No autorizado' }, 401) };
	const cfg = ghConfig(env);
	if (!cfg) return { error: json({ ok: false, error: 'Falta la variable GITHUB_PAT en Vercel' }, 500) };
	return { cfg };
}

export const GET = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const cfg = g.cfg!;
	const url = new URL(request.url);
	const action = url.searchParams.get('action');

	try {
		if (action === 'list') {
			const files = (await listDir(cfg, NOTAS_DIR)).filter((f) => /\.(md|mdx)$/.test(f.name));
			const items = await Promise.all(
				files.map(async (f) => {
					const file = await getFile(cfg, f.path);
					if (!file) return null;
					const { data } = splitFrontmatter(file.text);
					return {
						slug: f.name.replace(/\.(md|mdx)$/, ''),
						filename: f.name,
						sha: f.sha,
						title: data.title ?? f.name,
						section: data.section ?? '',
						date: fechaISO(data.pubDate),
						breaking: data.ultimoMomento === true,
						draft: data.draft === true,
					};
				})
			);
			const lista = items.filter(Boolean) as any[];
			lista.sort((a, b) => String(b.date).localeCompare(String(a.date)));
			return json(lista);
		}

		if (action === 'get') {
			const filename = url.searchParams.get('filename');
			if (!filename || filename.includes('..') || filename.includes('/')) return json({ ok: false, error: 'Falta el archivo' }, 400);
			if (filename.endsWith('.mdx')) return json({ ok: false, error: 'Las notas .mdx se editan directo en GitHub' }, 400);
			const file = await getFile(cfg, `${NOTAS_DIR}/${filename}`);
			if (!file) return json({ ok: false, error: 'No existe la nota' }, 404);
			const { data, body } = splitFrontmatter(file.text);
			return json({
				ok: true,
				sha: file.sha,
				filename,
				data: {
					title: data.title ?? '',
					volanta: data.volanta ?? '',
					excerpt: data.description ?? '',
					section: data.section ?? 'argentina',
					author: data.author ?? 'Redacción',
					date: fechaISO(data.pubDate),
					breaking: data.ultimoMomento === true,
					draft: data.draft === true,
					image_url: typeof data.heroImage === 'string' ? data.heroImage : '',
					imageCaption: data.imageCaption ?? '',
					tags: Array.isArray(data.tags) ? data.tags : [],
				},
				body: mdToHtml(body.trim()),
			});
		}
		return json({ ok: false, error: 'Acción desconocida' }, 400);
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const POST = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const cfg = g.cfg!;
	try {
		const { slug, filename, data, content, sha } = await request.json();
		if (!data?.title || !data?.excerpt) return json({ ok: false, error: 'Faltan título o resumen' }, 400);

		const fm: Record<string, any> = { title: data.title };
		if (data.volanta) fm.volanta = data.volanta;
		fm.description = data.excerpt;
		fm.section = data.section || 'argentina';
		fm.author = data.author || 'Redacción';
		fm.pubDate = data.date || new Date().toISOString().slice(0, 10);
		if (data.image_url) fm.heroImage = data.image_url;
		if (data.imageCaption) fm.imageCaption = data.imageCaption;
		if (data.breaking) fm.ultimoMomento = true;
		if (data.draft) fm.draft = true;
		fm.tags = Array.isArray(data.tags) ? data.tags : [];

		const texto = `---\n${stringify(fm, { lineWidth: 0 })}---\n\n${htmlParaArchivo(content || '')}\n`;

		const nombre = filename || `${String(slug).replace(/[^a-z0-9-]/g, '')}.md`;
		if (!filename && !slug) return json({ ok: false, error: 'Falta el slug' }, 400);
		const path = `${NOTAS_DIR}/${nombre}`;

		if (!sha && (await getFile(cfg, path))) {
			return json({ ok: false, error: 'Ya existe una nota con ese slug. Cambialo o editá la existente.' }, 409);
		}
		const nuevoSha = await putFile(cfg, path, texto, `${sha ? 'Editar' : 'Nueva'} nota: ${data.title.slice(0, 60)}`, sha || undefined);
		return json({ ok: true, sha: nuevoSha, filename: nombre });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};

export const DELETE = async ({ request, locals }: any) => {
	const g = await guard(request, locals);
	if (g.error) return g.error;
	const url = new URL(request.url);
	const filename = url.searchParams.get('filename');
	const sha = url.searchParams.get('sha');
	if (!filename || !sha || filename.includes('/') || filename.includes('..')) return json({ ok: false, error: 'Faltan datos' }, 400);
	try {
		await deleteFile(g.cfg!, `${NOTAS_DIR}/${filename}`, sha, `Eliminar nota: ${filename}`);
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e.message }, 500);
	}
};
