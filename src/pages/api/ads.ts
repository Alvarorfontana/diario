export const prerender = false;

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

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const FILE_PATH = 'data/ads.json';

interface Ad {
	id: string;
	client: string;
	imageUrl: string;
	linkUrl: string;
	placement: string;
	altText: string;
	startDate: string;
	endDate: string;
	enabled: boolean;
}

async function getAdsFile(token: string): Promise<{ ads: Ad[]; sha: string | null }> {
	const res = await fetch(
		`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
		{ headers: ghHeaders(token) }
	);
	if (!res.ok) return { ads: [], sha: null };
	const data = await res.json();
	return { ads: JSON.parse(b64decodeUtf8(data.content)), sha: data.sha };
}

async function saveAdsToGitHub(token: string, ads: Ad[], sha: string | null) {
	const body: Record<string, unknown> = {
		message: 'Update ads',
		content: b64encodeUtf8(JSON.stringify(ads, null, 2)),
		branch: BRANCH,
	};
	if (sha) body.sha = sha;

	const res = await fetch(
		`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
		{ method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
	);
	if (!res.ok) throw new Error('GitHub API error');
	return res.json();
}

// Simple auth: compare bearer token with ADMIN_PASSWORD env var
function isAuthorized(request: Request, adminPassword: string | undefined): boolean {
	const auth = request.headers.get('authorization');
	return !!adminPassword && auth === `Bearer ${adminPassword}`;
}

export const GET = async ({ locals }: ApiContext) => {
	try {
		const token = getEnv(locals).GITHUB_PAT;
		if (!token) {
			return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}
		const { ads } = await getAdsFile(token);
		return new Response(JSON.stringify(ads), { headers: { 'content-type': 'application/json' } });
	} catch {
		return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
	}
};

export const POST = async ({ request, locals }: ApiContext) => {
	const env = getEnv(locals);
	if (!isAuthorized(request, env.ADMIN_PASSWORD)) {
		return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
	}
	try {
		const token = env.GITHUB_PAT;
		if (!token) {
			return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}
		const body = await request.json();
		const { ads, sha } = await getAdsFile(token);

		const newAd: Ad = {
			id: Date.now().toString(36),
			client: body.client || '',
			imageUrl: body.imageUrl || '',
			linkUrl: body.linkUrl || '',
			placement: body.placement || 'sidebar',
			altText: body.altText || '',
			startDate: body.startDate || new Date().toISOString().slice(0, 10),
			endDate: body.endDate || '',
			enabled: body.enabled !== false,
		};

		ads.push(newAd);
		await saveAdsToGitHub(token, ads, sha);
		return new Response(JSON.stringify({ ok: true, ad: newAd }), { headers: { 'content-type': 'application/json' } });
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'Error al guardar' }), { status: 500, headers: { 'content-type': 'application/json' } });
	}
};

export const PUT = async ({ request, locals }: ApiContext) => {
	const env = getEnv(locals);
	if (!isAuthorized(request, env.ADMIN_PASSWORD)) {
		return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
	}
	try {
		const token = env.GITHUB_PAT;
		if (!token) {
			return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}
		const body = await request.json();
		const { id, ...updates } = body;
		const { ads, sha } = await getAdsFile(token);

		const index = ads.findIndex((a) => a.id === id);
		if (index === -1) {
			return new Response(JSON.stringify({ ok: false, error: 'Ad not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
		}

		ads[index] = { ...ads[index], ...updates, id };
		await saveAdsToGitHub(token, ads, sha);
		return new Response(JSON.stringify({ ok: true, ad: ads[index] }), { headers: { 'content-type': 'application/json' } });
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'Error al actualizar' }), { status: 500, headers: { 'content-type': 'application/json' } });
	}
};

export const DELETE = async ({ request, locals }: ApiContext) => {
	const env = getEnv(locals);
	if (!isAuthorized(request, env.ADMIN_PASSWORD)) {
		return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
	}
	try {
		const token = env.GITHUB_PAT;
		if (!token) {
			return new Response(JSON.stringify({ ok: false, error: 'GITHUB_PAT no configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}
		const url = new URL(request.url);
		const id = url.searchParams.get('id');
		if (!id) {
			return new Response(JSON.stringify({ ok: false, error: 'Missing id' }), { status: 400, headers: { 'content-type': 'application/json' } });
		}

		const { ads, sha } = await getAdsFile(token);
		const filtered = ads.filter((a) => a.id !== id);
		await saveAdsToGitHub(token, filtered, sha);
		return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: 'Error al eliminar' }), { status: 500, headers: { 'content-type': 'application/json' } });
	}
};
