import { readData } from '../../lib/datastore';
export const prerender = false;

import datosLocales from '../../../data/brasil2026.json';

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
		const { text } = await readData(FILE_PATH, token);
		if (!text) throw new Error('github');
		const json = JSON.parse(text);
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
