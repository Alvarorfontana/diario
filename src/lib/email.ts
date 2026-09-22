import { Resend } from 'resend';

const FROM_EMAIL = 'EL DIARIO <notificaciones@eldiario.com>';

interface EmailConfig {
	apiKey?: string;
	notifyEmail?: string;
}

// Las env vars se reciben como parámetro (portable: funciona en
// Cloudflare Workers, Vercel y Netlify sin process.env)
export async function notifyNewComment(
	articleTitle: string,
	author: string,
	text: string,
	articleUrl: string,
	config: EmailConfig = {}
) {
	const apiKey = config.apiKey ?? '';
	const notifyEmail = config.notifyEmail ?? 'alvarorfontana@gmail.com';

	if (!apiKey) {
		console.log('RESEND_API_KEY not set, skipping email notification');
		return;
	}

	const resend = new Resend(apiKey);

	try {
		await resend.emails.send({
			from: FROM_EMAIL,
			to: notifyEmail,
			subject: `Nuevo comentario en "${articleTitle}"`,
			html: `
				<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #e93323;">Nuevo comentario en EL DIARIO</h2>
					<p><strong>${author}</strong> comentó en:</p>
					<p style="color: #666;"><em>"${articleTitle}"</em></p>
					<div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
						<p style="margin: 0;">${text}</p>
					</div>
					<a href="${articleUrl}" style="display: inline-block; background: #e93323; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Ver artículo</a>
				</div>
			`,
		});
		console.log('Email notification sent');
	} catch (error) {
		console.error('Failed to send email notification:', error);
	}
}
