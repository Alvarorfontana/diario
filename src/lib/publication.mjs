import { createHash, timingSafeEqual } from 'node:crypto';
import { stringify } from 'yaml';
import sanitizeHtml from 'sanitize-html';

const MAX_BYTES = 1024 * 1024;
const DIR = 'src/content/articulos';
const hash = (value) => createHash('sha256').update(value).digest();
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});
function text(value, field, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400, 'campo_invalido', `Campo inválido: ${field}`);
  return value.trim();
}
function https(value, field, local = false) {
  const s = text(value, field, 2048);
  if (!s) return '';
  if (local && /^\/uploads\/[a-zA-Z0-9_./%-]+$/.test(s) && !s.includes('..')) return s;
  try { const u = new URL(s); if (u.protocol === 'https:' && !u.username && !u.password) return u.href; } catch { /* invalid */ }
  fail(400, 'url_invalida', `Se requiere una URL HTTPS válida: ${field}`);
}
async function readJson(request) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'tipo_invalido', 'Usá Content-Type: application/json');
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_BYTES) fail(413, 'contenido_grande', 'El JSON supera 1 MiB');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'json_invalido', 'Falta el cuerpo JSON');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); fail(413, 'contenido_grande', 'El JSON supera 1 MiB'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(400, 'json_invalido', 'El cuerpo no es JSON UTF-8 válido'); }
}
function validate(input, sections) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'json_invalido', 'Se espera un objeto JSON');
  const fields = new Set(['titulo', 'bajada', 'categoria', 'autor', 'contenido_html', 'estado', 'slug', 'fecha', 'volanta', 'imagen_url', 'epigrafe', 'etiquetas', 'fuentes', 'video_url']);
  for (const key of Object.keys(input)) if (!fields.has(key)) fail(400, 'campo_desconocido', `Campo desconocido: ${key}`);
  const titulo = text(input.titulo, 'titulo', 250, true);
  const bajada = text(input.bajada, 'bajada', 1500, true);
  const autor = text(input.autor, 'autor', 120, true);
  const categoria = normalize(text(input.categoria, 'categoria', 50, true));
  const section = categoria === 'politica' ? 'argentina' : sections.find((s) => normalize(s.nombre) === categoria || s.id === categoria)?.id;
  if (!section || !sections.some((s) => s.id === section)) fail(400, 'categoria_invalida', 'La categoría no existe en el diario');
  const estado = input.estado ?? 'borrador';
  if (!['publicado', 'borrador'].includes(estado)) fail(400, 'estado_invalido', 'estado debe ser publicado o borrador');
  const slug = input.slug === undefined ? slugify(titulo) : text(input.slug, 'slug', 100, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(400, 'slug_invalido', 'El slug solo admite letras minúsculas sin acentos, números y guiones');
  const fecha = input.fecha ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha) fail(400, 'fecha_invalida', 'fecha debe ser una fecha válida YYYY-MM-DD');
  const content = text(input.contenido_html, 'contenido_html', 800000, true);
  const clean = sanitizeHtml(content, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'figure', 'figcaption', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'],
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], th: ['scope'] },
    allowedSchemes: ['https', 'http', 'mailto'], allowedSchemesByTag: { img: ['https'] }, allowProtocolRelative: false,
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }) },
  }).trim();
  if (!sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim()) fail(400, 'contenido_vacio', 'El artículo debe contener texto');
  const tags = input.etiquetas ?? [];
  if (!Array.isArray(tags) || tags.length > 20) fail(400, 'etiquetas_invalidas', 'Se admiten hasta 20 etiquetas');
  const etiquetas = [...new Set(tags.map((v) => text(v, 'etiquetas', 80, true)))];
  const fuentes = input.fuentes ?? [];
  if (!Array.isArray(fuentes) || fuentes.length > 30) fail(400, 'fuentes_invalidas', 'Se admiten hasta 30 fuentes');
  const sources = fuentes.map((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) fail(400, 'fuentes_invalidas', 'Cada fuente necesita titulo y url');
    return { titulo: text(source.titulo, 'fuentes.titulo', 250, true), url: https(source.url, 'fuentes.url') || fail(400, 'fuentes_invalidas', 'Falta la URL de una fuente') };
  });
  let video = '';
  if (input.video_url !== undefined) {
    const url = new URL(https(input.video_url, 'video_url') || fail(400, 'video_invalido', 'Falta la URL del video'));
    const host = url.hostname.toLowerCase();
    const id = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'www.youtube.com'].includes(host) && url.pathname === '/watch' ? url.searchParams.get('v') : null;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) fail(400, 'video_invalido', 'video_url debe ser un enlace de YouTube válido');
    video = `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video de la nota" loading="lazy" allowfullscreen></iframe>`;
  }
  const fm = {
    title: titulo, description: bajada, section, author: autor, pubDate: fecha, draft: estado === 'borrador', tags: etiquetas,
  };
  const volanta = text(input.volanta, 'volanta', 120);
  const image = https(input.imagen_url, 'imagen_url', true);
  const caption = text(input.epigrafe, 'epigrafe', 1000);
  if (volanta) fm.volanta = volanta;
  if (image) fm.heroImage = image;
  if (caption) fm.imageCaption = caption;
  let body = clean;
  if (video) body += `\n${video}`;
  if (sources.length) body += `\n<h2>Fuentes</h2><ul>${sources.map((s) => `<li><a href="${escape(s.url)}" rel="noopener noreferrer">${escape(s.titulo)}</a></li>`).join('')}</ul>`;
  // A contiguous HTML block prevents Markdown syntax in input from escaping the sanitizer.
  body = `<div>\n${body.replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n')}\n</div>`;
  return { slug, estado, titulo, raw: `---\n${stringify(fm, { lineWidth: 0 })}---\n\n${body}\n` };
}
function configuration(env) {
  const token = env.PUBLICACION_GITHUB_TOKEN || env.GITHUB_PAT;
  const repo = env.PUBLICACION_GITHUB_REPO;
  const branch = env.PUBLICACION_GITHUB_BRANCH;
  if (!token || !repo || !branch || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) fail(503, 'almacenamiento_no_configurado', 'Falta configurar el repositorio, la rama o la credencial de publicación');
  return { token, repo, branch };
}
export async function publishArticle({ request, env, sections, fetcher = fetch }) {
  try {
    if (request.method !== 'POST') return json({ success: false, code: 'metodo_no_permitido', error: 'Usá POST' }, 405, { Allow: 'POST' });
    const expected = env.ARTICULOS_API_TOKEN;
    if (!expected || expected.length < 32) fail(503, 'api_no_configurada', 'La API de publicación no está configurada');
    const match = (request.headers.get('authorization') || '').match(/^Bearer ([^\s]+)$/i);
    if (!match || !timingSafeEqual(hash(match[1]), hash(expected))) return json({ success: false, code: 'no_autorizado', error: 'No autorizado' }, 401, { 'WWW-Authenticate': 'Bearer' });
    const cfg = configuration(env);
    const article = validate(await readJson(request), sections);
    if (article.estado === 'publicado' && env.PUBLICACION_PERMITIR_PUBLICAR !== 'true') fail(403, 'publicacion_deshabilitada', 'La publicación está deshabilitada; enviá un borrador');
    const base = `https://api.github.com/repos/${cfg.repo}`;
    const headers = { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'DiarioFederal-Publicacion' };
    async function gh(path, options = {}) {
      return fetcher(base + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
    }
    const meta = await gh('');
    if (!meta.ok) fail(503, 'repositorio_no_disponible', 'No se pudo verificar el repositorio de destino');
    const repo = await meta.json();
    if (typeof repo.private !== 'boolean' || typeof repo.full_name !== 'string' || repo.full_name.toLowerCase() !== cfg.repo.toLowerCase()) fail(503, 'repositorio_no_disponible', 'No se pudo verificar el repositorio de destino');
    if (!repo.private && (article.estado === 'borrador' || env.VERCEL_ENV === 'preview')) fail(409, 'repositorio_privado_requerido', 'Los borradores y las pruebas requieren un repositorio privado');
    const encoded = `${DIR}/${article.slug}.md`.split('/').map(encodeURIComponent).join('/');
    const ref = `?ref=${encodeURIComponent(cfg.branch)}`;
    const existing = await gh(`/contents/${encoded}${ref}`);
    let repeated = false, sha;
    if (existing.ok) {
      const file = await existing.json();
      if (file.encoding !== 'base64' || typeof file.content !== 'string') fail(503, 'archivo_no_disponible', 'No se pudo verificar la nota existente');
      if (Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8') !== article.raw) fail(409, 'slug_existente', 'Ya existe una nota diferente con ese slug; no se modificó');
      repeated = true; sha = file.sha;
    } else if (existing.status === 404) {
      const mdx = await gh(`/contents/${encoded.replace(/\.md$/, '.mdx')}${ref}`);
      if (mdx.ok) fail(409, 'slug_existente', 'Ya existe una nota con ese slug; no se modificó');
      if (mdx.status !== 404) fail(503, 'archivo_no_disponible', 'No se pudo verificar el slug');
      const saved = await gh(`/contents/${encoded}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: cfg.branch, message: `API: ${article.estado}: ${article.titulo.slice(0, 80)}`, content: Buffer.from(article.raw, 'utf8').toString('base64') }),
      });
      if ([409, 422].includes(saved.status)) fail(409, 'conflicto_guardado', 'No se pudo crear la nota: verificá el slug y la rama de destino');
      if (!saved.ok) fail(503, 'guardado_no_disponible', 'GitHub no pudo guardar la nota');
      const result = await saved.json(); sha = result.content?.sha;
      if (typeof sha !== 'string' || !sha) fail(503, 'guardado_no_confirmado', 'No se pudo confirmar el guardado; reintentá el mismo JSON');
    } else fail(503, 'archivo_no_disponible', 'No se pudo verificar el slug');
    let url = null;
    if (article.estado === 'publicado') {
      try {
        const origin = new URL(env.PUBLICACION_SITE_URL || 'https://www.diariofederal.com.ar');
        if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error();
        url = new URL(`/articulo/${article.slug}/`, origin.origin).href;
      } catch { /* Saving is confirmed; do not turn a URL configuration issue into a failed write. */ }
    }
    return json({ success: true, id: article.slug, sha, estado: article.estado, url, repetido: repeated, publicacion: article.estado === 'borrador' ? 'borrador_privado' : 'pendiente_despliegue', mensaje: article.estado === 'borrador' ? 'Borrador guardado en el repositorio privado; no se publica en el sitio' : 'Nota guardada. La URL estará disponible cuando finalice el despliegue del sitio' }, repeated ? 200 : 201);
  } catch (error) {
    if (error instanceof ApiError) return json({ success: false, code: error.code, error: error.message }, error.status);
    // Never reflect upstream bodies, tokens, request content or exception details.
    return json({ success: false, code: 'servicio_no_disponible', error: 'No se pudo completar la operación. Reintentá el mismo JSON' }, 503);
  }
}
