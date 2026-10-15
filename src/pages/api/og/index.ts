// /api/og sin slug no tiene imagen propia: en vez de un 404, redirige a la portada.
// La imagen real de cada nota es /api/og/<slug>.jpg (ver [slug].ts).
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ redirect }) => redirect('/');
