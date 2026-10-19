export const prerender = false;
import { brevoConfig, unsubscribe } from '../../../lib/brevo';

// Baja del newsletter. Por privacidad respondemos igual si el correo no estaba en la lista.
function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}

export const POST = async ({ request, locals }: { request: Request; locals?: unknown }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const email = String(body.email ?? '').trim().toLowerCase();

		if (!email.includes('@') || email.length > 254) {
			return json({ ok: false, error: 'Revisá el correo.' }, 400);
		}

		const cfg = brevoConfig(locals);
		if (!cfg) {
			return json({ ok: false, error: 'El boletín todavía no está configurado.' }, 503);
		}

		const r = await unsubscribe(cfg, email);
		// 404 = no estaba en la lista: igual confirmamos la baja.
		if (r.ok || r.status === 404) {
			return json({ ok: true, message: 'Listo. No vas a recibir más correos del boletín.' });
		}
		return json({ ok: false, error: 'No pudimos procesar la baja. Probá de nuevo.' }, 502);
	} catch {
		return json({ ok: false, error: 'Error del servidor.' }, 500);
	}
};
