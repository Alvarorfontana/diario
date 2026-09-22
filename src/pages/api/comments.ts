export const prerender = false;

import { notifyNewComment } from '../../lib/email';

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const FILE_PATH = 'data/comments.json';

// ─── Acceso portable a variables de entorno ────────────────────────────────
// Cloudflare Workers expone las env vars en locals.runtime.env.
// Vercel / Netlify / Node las exponen en import.meta.env.
type RuntimeEnv = Record<string, string | undefined>;

interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}

function getEnv(locals: ApiContext['locals']): RuntimeEnv {
	const runtimeEnv = locals?.runtime?.env;
	return runtimeEnv ?? (import.meta.env as unknown as RuntimeEnv);
}

function ghHeaders(token: string) {
	return {
		Authorization: `token ${token}`,
		Accept: 'application/vnd.github+json',
	};
}

// Base64 UTF-8 con APIs web (funciona en Node, Workers, Deno, etc.)
function b64encodeUtf8(text: string): string {
	return btoa(unescape(encodeURIComponent(text)));
}

function b64decodeUtf8(b64: string): string {
	return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

// ─── Storage en GitHub (data/comments.json) ────────────────────────────────

interface Comment {
	id: string;
	articleId: string;
	author: string;
	text: string;
	date: string;
}

async function readCommentsFile(token: string): Promise<{ comments: Comment[]; sha: string | null }> {
	try {
		const res = await fetch(
			`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
			{ headers: ghHeaders(token) }
		);
		if (!res.ok) return { comments: [], sha: null };
		const data = await res.json();
		return { comments: JSON.parse(b64decodeUtf8(data.content)), sha: data.sha };
	} catch {
		return { comments: [], sha: null };
	}
}

async function writeCommentsFile(token: string, comments: Comment[], sha: string | null) {
	const body: Record<string, unknown> = {
		message: 'Update comments',
		content: b64encodeUtf8(JSON.stringify(comments, null, 2)),
		branch: BRANCH,
	};
	if (sha) body.sha = sha;

	const res = await fetch(
		`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
		{ method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
	);
	return res.json();
}

// ─── Handlers ──────────────────────────────────────────────────────────────

export const GET = async ({ request, locals }: ApiContext) => {
	const url = new URL(request.url);
	const articleId = url.searchParams.get('articleId');
	if (!articleId) return new Response('Missing articleId', { status: 400 });

	const token = getEnv(locals).GITHUB_PAT;
	if (!token) {
		return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}

	const { comments } = await readCommentsFile(token);
	const filtered = comments.filter((c) => c.articleId === articleId);

	return new Response(JSON.stringify(filtered), {
		headers: { 'content-type': 'application/json' },
	});
};

export const POST = async ({ request, locals }: ApiContext) => {
	try {
		const token = getEnv(locals).GITHUB_PAT;
		if (!token) {
			return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}

		const body = await request.json();
		const { articleId, author, text } = body;

		if (!articleId || !author || !text) {
			return new Response(JSON.stringify({ ok: false, error: 'Faltan campos' }), {
				status: 400,
				headers: { 'content-type': 'application/json' },
			});
		}

		const { comments, sha } = await readCommentsFile(token);

		const newComment: Comment = {
			id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
			articleId,
			author: author.slice(0, 50),
			text: text.slice(0, 1000),
			date: new Date().toISOString(),
		};

		comments.push(newComment);
		const result = await writeCommentsFile(token, comments, sha);

		if (result.commit) {
			// Send email notification (non-blocking)
			const articleUrl = `${new URL(request.url).origin}/articulo/${articleId}/`;
			notifyNewComment(articleId, author, text, articleUrl, {
				apiKey: getEnv(locals).RESEND_API_KEY,
				notifyEmail: getEnv(locals).NOTIFY_EMAIL,
			}).catch(() => {});

			return new Response(JSON.stringify({ ok: true, comment: newComment }), {
				headers: { 'content-type': 'application/json' },
			});
		}
		return new Response(JSON.stringify({ ok: false, error: 'GitHub API error', detail: result.message }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'Error del servidor' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
};
