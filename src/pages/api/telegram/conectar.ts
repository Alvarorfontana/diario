// Conecta el bot con el sitio. Se abre una sola vez, con la sesión de /admin iniciada.
export const prerender = false;

import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { claveWebhook, llamarTelegram, SITIO } from '../../../lib/telegram-servidor';

const pagina = (texto: string, status = 200) =>
	new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bot de Telegram</title><body style="font:18px/1.5 system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem">${texto}</body>`, {
		status,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
	});

export const GET: APIRoute = async ({ request, locals }) => {
	const env = getRuntimeEnv(locals);
	if (!(await isAdmin(request, env))) return pagina('Primero entrá a <a href="/admin">/admin</a> con tu contraseña y volvé a abrir esta página.', 401);
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) return pagina('Falta cargar TELEGRAM_BOT_TOKEN en Vercel y volver a desplegar.', 503);
	try {
		await llamarTelegram(token, 'setWebhook', {
			url: `${SITIO}/api/telegram/webhook`,
			secret_token: await claveWebhook(token),
			allowed_updates: ['message', 'callback_query'],
			max_connections: 1, // de a un mensaje por vez, para que el texto partido llegue en orden
			drop_pending_updates: true,
		});
		await llamarTelegram(token, 'setMyCommands', {
			commands: [
				{ command: 'nueva', description: 'Empezar una nota de cero' },
				{ command: 'plantilla', description: 'Ver la plantilla de la ficha' },
				{ command: 'ayuda', description: 'Cómo cargar una nota' },
			],
		});
		return pagina(`<b>Bot conectado.</b><br>Mandale un mensaje en Telegram.${env.TELEGRAM_USUARIO_ID ? '' : ' Te va a contestar con tu número, que hay que cargar en Vercel como TELEGRAM_USUARIO_ID.'}`);
	} catch {
		return pagina('No se pudo conectar. Revisá que el token cargado en Vercel sea el que te dio BotFather.', 502);
	}
};
