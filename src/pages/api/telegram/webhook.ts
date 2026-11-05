// Telegram avisa acá cada mensaje que recibe el bot.
export const prerender = false;

import { timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getRuntimeEnv } from '../../../lib/runtimeEnv';
import { atender } from '../../../lib/telegram-bot.mjs';
import { claveWebhook, crearContexto } from '../../../lib/telegram-servidor';

export const POST: APIRoute = async ({ request, locals }) => {
	const env = getRuntimeEnv(locals);
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) return new Response('Bot sin configurar', { status: 503 });

	const esperada = Buffer.from(await claveWebhook(token));
	const recibida = Buffer.from(request.headers.get('x-telegram-bot-api-secret-token') ?? '');
	if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return new Response('No autorizado', { status: 401 });

	// Siempre se contesta 200: si no, Telegram repite el mismo mensaje una y otra vez.
	try {
		await atender(await request.json(), crearContexto(env));
	} catch (e) {
		console.error('[telegram]', e instanceof Error ? e.message : 'error');
	}
	return new Response('ok');
};
