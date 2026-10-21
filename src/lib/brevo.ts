// Integración con Brevo para el newsletter del Diario Federal.
// El alta usa "doble confirmación" (Brevo manda el correo y suma al contacto recién cuando el
// lector confirma). Si no hay plantilla de doble confirmación configurada, cae a alta directa.
//
// Variables de entorno (Vercel > Settings > Environment Variables):
//   BREVO_API_KEY            (obligatoria)  API key de Brevo.
//   BREVO_LIST_ID            (obligatoria)  Id numérico de la lista de suscriptores.
//   BREVO_DOI_TEMPLATE_ID    (recomendada)  Id de la plantilla de doble confirmación.
//   BREVO_REDIRECT_URL       (opcional)     A dónde va el lector al confirmar.
//   BREVO_SENDER_EMAIL       (opcional)     Remitente verificado (boletin@diariofederal.com.ar).
//   BREVO_SENDER_NAME        (opcional)     Nombre del remitente.
//   BREVO_LIST_MESA_POLITICA, BREVO_LIST_PULSO_FEDERAL, BREVO_LIST_AGENDA_ECONOMICA
//                            (opcionales)   Id de la lista de cada boletín temático. Los que estén
//                                           cargados aparecen como opción en el formulario.
import { getRuntimeEnv } from './runtimeEnv';

const API = 'https://api.brevo.com/v3';

// Boletines temáticos. Cada uno es una lista aparte en Brevo.
export const TEMAS = [
	{ id: 'mesa-politica', nombre: 'Mesa Política', descripcion: 'Lo que se negocia en el Congreso y la Casa Rosada.', env: 'BREVO_LIST_MESA_POLITICA' },
	{ id: 'pulso-federal', nombre: 'Pulso Federal', descripcion: 'Las provincias, sus gobernadores y sus disputas.', env: 'BREVO_LIST_PULSO_FEDERAL' },
	{ id: 'agenda-economica', nombre: 'Agenda Económica', descripcion: 'Los números que mueven la semana, explicados.', env: 'BREVO_LIST_AGENDA_ECONOMICA' },
] as const;

export interface BrevoConfig {
	apiKey: string;
	listId: number;
	// Listas de los boletines temáticos configurados (id del tema → id de la lista en Brevo)
	temas: Record<string, number>;
	doiTemplateId: number | null;
	redirectUrl: string;
	senderEmail?: string;
	senderName?: string;
}

export function brevoConfig(locals?: unknown): BrevoConfig | null {
	const env = getRuntimeEnv(locals);
	const apiKey = env.BREVO_API_KEY;
	const listId = Number(env.BREVO_LIST_ID);
	if (!apiKey || !Number.isFinite(listId) || listId <= 0) return null;

	const doi = Number(env.BREVO_DOI_TEMPLATE_ID);
	const temas: Record<string, number> = {};
	for (const t of TEMAS) {
		const n = Number(env[t.env]);
		if (Number.isFinite(n) && n > 0) temas[t.id] = n;
	}
	return {
		apiKey,
		listId,
		temas,
		doiTemplateId: Number.isFinite(doi) && doi > 0 ? doi : null,
		redirectUrl: env.BREVO_REDIRECT_URL || 'https://www.diariofederal.com.ar/newsletter/confirmado/',
		senderEmail: env.BREVO_SENDER_EMAIL || undefined,
		senderName: env.BREVO_SENDER_NAME || undefined,
	};
}

export interface BrevoResult {
	ok: boolean;
	status: number;
	mode: 'doi' | 'direct' | 'unsub';
	data: unknown;
}

async function call(cfg: BrevoConfig, path: string, method: string, body: unknown): Promise<Omit<BrevoResult, 'mode'>> {
	const res = await fetch(API + path, {
		method,
		headers: { 'api-key': cfg.apiKey, 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(body),
	});
	const text = await res.text();
	let data: unknown = null;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = text;
		}
	}
	return { ok: res.ok, status: res.status, data };
}

/** Alta del suscriptor. Con plantilla DOI, Brevo envía el correo y suma al confirmar. */
export async function subscribe(cfg: BrevoConfig, email: string, temas: string[] = []): Promise<BrevoResult> {
	// Siempre el boletín general, más los temáticos que eligió el lector.
	const listas = [cfg.listId, ...temas.map((t) => cfg.temas[t]).filter((n): n is number => Boolean(n))];
	const listIds = [...new Set(listas)];
	if (cfg.doiTemplateId) {
		const r = await call(cfg, '/contacts/doubleOptinConfirmation', 'POST', {
			email,
			includeListIds: listIds,
			templateId: cfg.doiTemplateId,
			redirectionUrl: cfg.redirectUrl,
		});
		return { ...r, mode: 'doi' };
	}
	const r = await call(cfg, '/contacts', 'POST', {
		email,
		listIds,
		updateEnabled: true,
	});
	return { ...r, mode: 'direct' };
}

/** Baja: marca el correo como bloqueado y lo saca de la lista. */
export async function unsubscribe(cfg: BrevoConfig, email: string): Promise<BrevoResult> {
	const r = await call(cfg, '/contacts/' + encodeURIComponent(email), 'PUT', {
		emailBlacklisted: true,
		unlinkListIds: [cfg.listId, ...Object.values(cfg.temas)],
	});
	return { ...r, mode: 'unsub' };
}
