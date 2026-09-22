export const prerender = false;

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const FILE_PATH = 'data/subscribers.json';

// ─── Acceso portable a variables de entorno ────────────────────────────────
// Cloudflare Workers: locals.runtime.env | Vercel/Netlify/Node: import.meta.env
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

function b64encodeUtf8(text: string): string {
	return btoa(unescape(encodeURIComponent(text)));
}

function b64decodeUtf8(b64: string): string {
	return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

async function readSubscribersFile(token: string): Promise<{ emails: string[]; sha: string | null }> {
	try {
		const res = await fetch(
			`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
			{ headers: ghHeaders(token) }
		);
		if (!res.ok) return { emails: [], sha: null };
		const data = await res.json();
		return { emails: JSON.parse(b64decodeUtf8(data.content)), sha: data.sha };
	} catch {
		return { emails: [], sha: null };
	}
}

async function writeSubscribersFile(token: string, emails: string[], sha: string | null) {
	const body: Record<string, unknown> = {
		message: 'Update subscribers',
		content: b64encodeUtf8(JSON.stringify(emails, null, 2)),
		branch: BRANCH,
	};
	if (sha) body.sha = sha;

	const res = await fetch(
		`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
		{ method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
	);
	return res.json();
}

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
		const email = body.email as string;

		if (!email || !email.includes('@')) {
			return new Response(JSON.stringify({ ok: false, error: 'Email inválido' }), {
				status: 400,
				headers: { 'content-type': 'application/json' },
			});
		}

		const { emails, sha } = await readSubscribersFile(token);
		if (emails.includes(email)) {
			return new Response(JSON.stringify({ ok: true, message: 'Ya estás suscripto' }), {
				headers: { 'content-type': 'application/json' },
			});
		}

		emails.push(email);
		const result = await writeSubscribersFile(token, emails, sha);

		if (result.commit) {
			return new Response(JSON.stringify({ ok: true, message: '¡Suscripción exitosa!' }), {
				headers: { 'content-type': 'application/json' },
			});
		}
		return new Response(JSON.stringify({ ok: false, error: 'Error al guardar' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify({ ok: false, error: 'Error del servidor' }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
};
