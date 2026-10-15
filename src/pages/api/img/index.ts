// /api/img sin slug no tiene foto asociada: en vez de un 404, redirige a la portada.
// La foto real de cada nota es /api/img/<slug>.jpg?w=<ancho> (ver [slug].ts).
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ redirect }) => redirect('/');
