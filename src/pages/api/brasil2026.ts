export const prerender = false;

import datosLocales from '../../../data/brasil2026.json';

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const FILE_PATH = 'data/brasil2026.json';

type RuntimeEnv = Record<string, string | undefined>;
interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}
function getEnv(locals: ApiContext['locals']): RuntimeEnv {
	return locals?.runtime?.env ?? (import.meta.env as unknown as RuntimeEnv);
}
function b64decodeUtf8(b64: string): string {
	return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

export const GET = async ({ locals }: ApiContext) => {
	try {
		const token = getEnv(locals).GITHUB_PAT;
		if (!token) throw new Error('sin token');
		const res = await fetch(
			`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
			{ headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' } }
		);
		if (!res.ok) throw new Error('github');
		const data = await res.json();
		const json = JSON.parse(b64decodeUtf8(data.content));
		return new Response(JSON.stringify(json), {
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	} catch {
		// Fallback: datos empaquetados en el build
		return new Response(JSON.stringify(datosLocales), {
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	}
};
