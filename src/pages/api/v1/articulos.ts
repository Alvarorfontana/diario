import type { APIRoute } from 'astro';
import { SECCIONES } from '../../../consts';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { publishArticle } from '../../../lib/publication.mjs';

export const prerender = false;
export const POST: APIRoute = ({ request, locals }) => publishArticle({
  request,
  env: getRuntimeEnv(locals),
  sections: SECCIONES,
});
export const ALL: APIRoute = POST;
