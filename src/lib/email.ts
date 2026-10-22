import { Resend } from 'resend';
import { escaparHtml } from './comentarios';

// Remitente: mientras no haya un dominio verificado en Resend, se usa el de prueba
// de Resend (onboarding@resend.dev), que solo puede mandar al mail de la propia
// cuenta de Resend. Para el aviso de comentarios alcanza.
// Con el dominio verificado: RESEND_FROM="Diario Federal <avisos@diariofederal.com.ar>"
const FROM_POR_DEFECTO = 'Diario Federal <onboarding@resend.dev>';

interface EmailConfig {
	apiKey?: string;
	notifyEmail?: string;
	from?: string;
}

interface AvisoComentario {
	tituloNota: string;
	autor: string;
	texto: string;
	urlNota: string;
	urlAprobar: string;
	urlBorrar: string;
	urlPanel: string;
}

const boton = (href: string, texto: string, fondo: string, color = '#ffffff') =>
	`<a href="${escaparHtml(href)}" style="display:inline-block;background:${fondo};color:${color};padding:12px 22px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:0 8px 8px 0;">${texto}</a>`;

/** Avisa por mail que entró un comentario nuevo, con botones para aprobarlo o borrarlo. */
export async function notifyNewComment(aviso: AvisoComentario, config: EmailConfig = {}): Promise<boolean> {
	const apiKey = config.apiKey ?? '';
	const notifyEmail = config.notifyEmail || 'alvarorfontana@gmail.com';

	if (!apiKey) {
		console.log('RESEND_API_KEY no configurada: no se manda el aviso de comentario');
		return false;
	}

	const resend = new Resend(apiKey);
	const { error } = await resend.emails.send({
		from: config.from || FROM_POR_DEFECTO,
		to: notifyEmail,
		subject: `Comentario para aprobar: "${aviso.tituloNota}"`,
		html: `
			<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#16161a;">
				<p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d0021b;margin:0 0 6px;">Diario Federal · Comentarios</p>
				<h2 style="margin:0 0 16px;font-size:20px;">Hay un comentario esperando aprobación</h2>
				<p style="margin:0 0 4px;"><strong>${escaparHtml(aviso.autor)}</strong> comentó en:</p>
				<p style="margin:0 0 16px;"><a href="${escaparHtml(aviso.urlNota)}" style="color:#16161a;">${escaparHtml(aviso.tituloNota)}</a></p>
				<div style="background:#f5f5f4;padding:16px;border-radius:10px;margin:0 0 20px;white-space:pre-line;">${escaparHtml(aviso.texto)}</div>
				${boton(aviso.urlAprobar, '✓ Aprobar', '#1f8f4e')}
				${boton(aviso.urlBorrar, '✕ Borrar', '#ffffff', '#d0021b')}
				<p style="font-size:13px;color:#666;margin:16px 0 0;">Hasta que lo apruebes no se ve en el sitio. También podés revisar todos en el <a href="${escaparHtml(aviso.urlPanel)}" style="color:#d0021b;">panel de comentarios</a>.</p>
			</div>
		`,
	});

	if (error) {
		console.error('No se pudo mandar el aviso de comentario:', error);
		return false;
	}
	return true;
}
