export const prerender = false;

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const CONTENT_PATH = 'src/content/articulos';

type RuntimeEnv = Record<string, string | undefined>;
interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}
function getEnv(locals: ApiContext['locals']): RuntimeEnv {
	return locals?.runtime?.env ?? (import.meta.env as unknown as RuntimeEnv);
}
function ghHeaders(token: string) {
	return { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' };
}
function requireToken(locals: ApiContext['locals']): { token: string } | { error: Response } {
	const token = getEnv(locals).GITHUB_PAT;
	if (!token) {
		return { error: new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), { status: 500, headers: { 'content-type': 'application/json' } }) };
	}
	return { token };
}
function b64encodeUtf8(text: string): string {
	return btoa(unescape(encodeURIComponent(text)));
}
function b64decodeUtf8(b64: string): string {
	return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

async function getFile(path: string, token: string) {
	const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: ghHeaders(token) });
	if (!res.ok) return null;
	return res.json();
}
async function createOrUpdateFile(path: string, content: string, message: string, token: string, sha?: string) {
	const body: Record<string, unknown> = { message, content: b64encodeUtf8(content), branch: BRANCH };
	if (sha) body.sha = sha;
	const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
		method: 'PUT',
		headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return res.json();
}
async function listFiles(token: string) {
	const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${CONTENT_PATH}?ref=${BRANCH}`, { headers: ghHeaders(token) });
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data) ? data.filter((f: { name: string }) => f.name.endsWith('.md') || f.name.endsWith('.mdx')) : [];
}

function parseFrontmatter(content: string) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) return { data: {}, body: content };
	const lines = match[1].split('\n');
	const data: Record<string, string> = {};
	let currentKey = '';
	for (const line of lines) {
		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (kv) {
			currentKey = kv[1];
			data[currentKey] = kv[2].replace(/^["']|["']$/g, '');
		} else if (currentKey && line.startsWith('  - ')) {
			data[currentKey] = (data[currentKey] ? data[currentKey] + ',' : '') + line.replace('  - ', '');
		}
	}
	return { data, body: match[2].trim() };
}

function buildFrontmatter(data: Record<string, unknown>) {
	let fm = '---\n';
	for (const [key, raw] of Object.entries(data)) {
		const value = raw === undefined || raw === null ? '' : String(raw).trim();
		if (!value) continue;

		if (key === 'ultimoMomento') {
			if (value === 'true' || value === true) fm += 'ultimoMomento: true\n';
			continue;
		}
		if (key === 'pubDate' || key === 'updatedDate') {
			fm += `${key}: ${value}\n`;
			continue;
		}
		if (key === 'tags') {
			const tags = value.split(',').map((t) => t.trim()).filter(Boolean);
			if (tags.length) {
				fm += 'tags:\n';
				tags.forEach((t) => { fm += `  - ${t}\n`; });
			}
			continue;
		}
		if (key === 'heroImage') {
			fm += `heroImage: "${value}"\n`;
			continue;
		}
		fm += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
	}
	fm += '---\n';
	return fm;
}

export const GET = async ({ request, locals }: ApiContext) => {
	const auth = requireToken(locals);
	if ('error' in auth) return auth.error;
	const { token } = auth;

	const url = new URL(request.url);
	const action = url.searchParams.get('action');

	if (action === 'list') {
		const files = await listFiles(token);
		const articles = await Promise.all(
			files.map(async (f: { name: string; sha: string; path: string }) => {
				const file = await getFile(f.path, token);
				if (!file) return null;
				const content = b64decodeUtf8(file.content);
				const { data } = parseFrontmatter(content);
				return { slug: f.name.replace(/\.(md|mdx)$/, ''), sha: f.sha, ...data };
			})
		);
		return new Response(JSON.stringify(articles.filter(Boolean)), { headers: { 'content-type': 'application/json' } });
	}

	if (action === 'get') {
		const slug = url.searchParams.get('slug');
		if (!slug) return new Response('Missing slug', { status: 400 });
		const file = (await getFile(`${CONTENT_PATH}/${slug}.md`, token)) ?? (await getFile(`${CONTENT_PATH}/${slug}.mdx`, token));
		if (!file) return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
		const content = b64decodeUtf8(file.content);
		const { data, body } = parseFrontmatter(content);
		return new Response(JSON.stringify({ ok: true, sha: file.sha, data, body }), { headers: { 'content-type': 'application/json' } });
	}

	return new Response('Unknown action', { status: 400 });
};

export const POST = async ({ request, locals }: ApiContext) => {
	const auth = requireToken(locals);
	if ('error' in auth) return auth.error;
	const { token } = auth;

	const body = await request.json();
	const { slug, data, content, sha } = body;

	if (!slug || !data) return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });

	const fullContent = buildFrontmatter(data) + '\n' + (content || '');
	const message = sha ? `Update: ${data.title || slug}` : `New: ${data.title || slug}`;
	const path = `${CONTENT_PATH}/${slug}.md`;

	const result = await createOrUpdateFile(path, fullContent, message, token, sha);
	if (result.commit || result.content) {
		return new Response(JSON.stringify({ ok: true, sha: result.content?.sha }), { headers: { 'content-type': 'application/json' } });
	}
	return new Response(JSON.stringify({ ok: false, error: 'GitHub API error', detail: result.message }), { status: 500, headers: { 'content-type': 'application/json' } });
};

export const DELETE = async ({ request, locals }: ApiContext) => {
	const auth = requireToken(locals);
	if ('error' in auth) return auth.error;
	const { token } = auth;

	const url = new URL(request.url);
	const slug = url.searchParams.get('slug');
	const sha = url.searchParams.get('sha');
	if (!slug || !sha) return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });

	const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${CONTENT_PATH}/${slug}.md`, {
		method: 'DELETE',
		headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: `Delete: ${slug}`, sha, branch: BRANCH }),
	});
	return new Response(JSON.stringify({ ok: res.ok }), { headers: { 'content-type': 'application/json' } });
};
