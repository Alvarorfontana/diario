export const prerender = false;
import { brevoConfig, subscribe } from '../../../lib/brevo';

// Alta al newsletter. Con doble confirmación, Brevo envía el correo y suma al lector
// recién cuando confirma. No guarda direcciones en el repositorio.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}

function isDuplicate(data: unknown): boolean {
	const code = (data as { code?: string } | null)?.code;
	return code === 'duplicate_parameter' || code === 'contact_already_exists' || code === 'contact_already_in_list';
}

export const POST = async ({ request, locals }: { request: Request; locals?: unknown }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

		// Trampa anti-robots: un humano no ve ni completa este campo.
		if (body.website) return json({ ok: true, message: '¡Gracias! Revisá tu correo.' });

		if (body.consent !== true) {
			return json({ ok: false, error: 'Tenés que aceptar recibir el boletín.' }, 400);
		}

		const email = String(body.email ?? '').trim().toLowerCase();
		if (!EMAIL_RE.test(email) || email.length > 254) {
			return json({ ok: false, error: 'Revisá el correo: parece incompleto.' }, 400);
		}

		const cfg = brevoConfig(locals);
		if (!cfg) {
			return json({ ok: false, error: 'El boletín todavía no está configurado. Probá más tarde.' }, 503);
		}

		const r = await subscribe(cfg, email);

		if (r.ok) {
			return json({
				ok: true,
				message:
					r.mode === 'doi'
						? '¡Listo! Te enviamos un correo para confirmar la suscripción.'
						: '¡Gracias por suscribirte!',
			});
		}

		if (r.status === 400 && isDuplicate(r.data)) {
			return json({ ok: true, message: 'Ya estás en la lista. Si no confirmaste, revisá tu correo.' });
		}

		return json({ ok: false, error: 'No pudimos completar la suscripción. Probá de nuevo.' }, 502);
	} catch {
		return json({ ok: false, error: 'Error del servidor.' }, 500);
	}
};
