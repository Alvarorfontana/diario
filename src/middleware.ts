import { defineMiddleware } from 'astro:middleware';

/**
 * Corrección global y conservadora de "mojibake" UTF-8.
 *
 * No toca texto que ya está bien. Solo reemplaza secuencias típicas que
 * aparecen cuando UTF-8 fue interpretado como Windows-1252/Latin-1.
 */
const MOJIBAKE: Array<[string, string]> = [
	['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
	['Ã', 'Á'], ['Ã‰', 'É'], ['Ã', 'Í'], ['Ã“', 'Ó'], ['Ãš', 'Ú'],
	['Ã±', 'ñ'], ['Ã‘', 'Ñ'],
	['Ã£', 'ã'], ['Ãµ', 'õ'], ['Ã¢', 'â'], ['Ãª', 'ê'], ['Ã´', 'ô'],
	['Ã€', 'À'], ['Ã ', 'à'], ['Ã‡', 'Ç'], ['Ã§', 'ç'],
	['Â¿', '¿'], ['Â¡', '¡'], ['Â·', '·'], ['Â°', '°'], ['Â', ''],
	['â†’', '→'], ['â†', '←'], ['â†‘', '↑'], ['â†“', '↓'], ['â†—', '↗'],
	['â€œ', '“'], ['â€', '”'], ['â€˜', '‘'], ['â€™', '’'],
	['â€“', '–'], ['â€”', '—'], ['â€¦', '…'],
	['â‚¬', '€'], ['â€¢', '•'],
];

function repararMojibake(texto: string): string {
	let salida = texto;
	// Dos pasadas permiten reparar texto que haya sido recodificado más de una vez.
	for (let pasada = 0; pasada < 2; pasada++) {
		let cambio = false;
		for (const [malo, bueno] of MOJIBAKE) {
			if (salida.includes(malo)) {
				salida = salida.split(malo).join(bueno);
				cambio = true;
			}
		}
		if (!cambio) break;
	}
	return salida;
}

export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();
	const headers = new Headers(response.headers);
	const contentType = headers.get('content-type') ?? '';

	// Asegura UTF-8 explícitamente en HTML, JSON, XML y texto.
	if (
		contentType.includes('text/html') ||
		contentType.includes('application/json') ||
		contentType.includes('application/xml') ||
		contentType.includes('text/xml') ||
		contentType.includes('text/plain')
	) {
		const mime = contentType.split(';')[0].trim() || 'text/html';
		headers.set('content-type', `${mime}; charset=utf-8`);
	}

	// Para HTML, además repara secuencias ya dañadas antes de enviarlas al navegador.
	if (contentType.includes('text/html')) {
		const html = await response.text();
		const reparado = repararMojibake(html);
		headers.delete('content-length');

		return new Response(reparado, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
});
