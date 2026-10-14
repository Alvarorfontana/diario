// Verificación de Google Search Console (no borrar).
// Se sirve desde código y no desde /public para que Pagefind no intente indexarlo y rompa el build.
export const prerender = false;

export function GET() {
	return new Response('google-site-verification: googlef057d368c1346443.html', {
		headers: { 'content-type': 'text/html; charset=utf-8' },
	});
}
