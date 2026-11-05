// Conecta la lógica del bot con Telegram, GitHub y el repo de datos.
import sharp from 'sharp';
import { SECCIONES } from '../consts';
import { getFile, ghConfig, NOTAS_DIR, putFile } from './github';
import { b64encodeBytes, getDataRepo, readData, writeData } from './datastore';
import { armarNota, slugify } from './telegram-bot.mjs';

export const SITIO = 'https://www.diariofederal.com.ar';
const SESION = 'telegram/sesion.json';
type Env = Record<string, string | undefined>;

/** Clave que Telegram manda en cada aviso, para saber que viene de ahí. Sale del token del bot. */
export async function claveWebhook(token: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`diario-telegram:${token}`));
	return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function llamarTelegram(token: string, metodo: string, datos: unknown) {
	const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(datos),
		signal: AbortSignal.timeout(15000),
	});
	const j = await res.json();
	if (!j.ok) throw new Error(`Telegram ${metodo}: ${res.status}`);
	return j.result;
}

async function leerWord(bytes: Uint8Array): Promise<string> {
	const { default: mammoth } = await import('mammoth');
	const res = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, {
		styleMap: [
			"p[style-name='Heading 1'] => h2:fresh", "p[style-name='Título 1'] => h2:fresh",
			"p[style-name='Heading 2'] => h3:fresh", "p[style-name='Título 2'] => h3:fresh",
			"p[style-name='Quote'] => blockquote:fresh", "p[style-name='Cita'] => blockquote:fresh",
		],
	});
	return res.value;
}

export function crearContexto(env: Env) {
	const token = env.TELEGRAM_BOT_TOKEN!;
	const github = env.GITHUB_PAT;
	const cfg = ghConfig(env);
	if (!github || !cfg) throw new Error('Falta GITHUB_PAT');
	if (!getDataRepo(env).separate) throw new Error('Falta DATA_REPO');
	let shaSesion: string | null = null;
	const hoy = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

	return {
		usuarioId: env.TELEGRAM_USUARIO_ID,
		secciones: SECCIONES as unknown as { id: string; nombre: string }[],
		tg: (metodo: string, datos: unknown) => llamarTelegram(token, metodo, datos),
		registrar: (e: unknown) => console.error('[telegram]', e instanceof Error ? e.message : 'error'),
		async descargar(fileId: string): Promise<Uint8Array> {
			const info = await llamarTelegram(token, 'getFile', { file_id: fileId });
			const res = await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(20000) });
			if (!res.ok) throw new Error(`Telegram archivo: ${res.status}`);
			return new Uint8Array(await res.arrayBuffer());
		},
		word: leerWord,
		async leerSesion() {
			const { text, sha } = await readData(SESION, github, env);
			shaSesion = sha;
			return text ? JSON.parse(text) : null;
		},
		async guardarSesion(s: unknown) {
			const r = await writeData(SESION, JSON.stringify(s), shaSesion, '[sin-deploy] Bot: nota en curso', github, env);
			shaSesion = r?.content?.sha ?? null;
		},
		// La foto se achica para que entre siempre en el límite del sitio.
		async subirFoto(bytes: Uint8Array): Promise<string> {
			const jpg = await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
			const nombre = `${Date.now()}-telegram.jpg`;
			await writeData(`uploads/${nombre}`, b64encodeBytes(new Uint8Array(jpg)), null, `Subir imagen: ${nombre}`, github, env, true);
			return `/media/${nombre}`;
		},
		async guardarNota(s: { ficha: { titulo: string } }, borrador: boolean) {
			const base = slugify(s.ficha.titulo);
			let slug = base;
			for (let n = 2; (await getFile(cfg, `${NOTAS_DIR}/${slug}.md`)) || (await getFile(cfg, `${NOTAS_DIR}/${slug}.mdx`)); n++) slug = `${base}-${n}`;
			const raw = armarNota(s, SECCIONES, borrador, hoy());
			const titulo = s.ficha.titulo.slice(0, 60);
			// El borrador no aparece en el sitio, así que no hace falta actualizarlo.
			await putFile(cfg, `${NOTAS_DIR}/${slug}.md`, raw, borrador ? `[sin-deploy] Borrador desde Telegram: ${titulo}` : `Nueva nota desde Telegram: ${titulo}`);
			return { slug, url: `${SITIO}/articulo/${slug}/` };
		},
	};
}
