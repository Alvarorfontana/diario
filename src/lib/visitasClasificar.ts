// Clasifica una visita en variables legibles (origen, dispositivo, lugar, hora...).
// Todo se calcula en el momento y solo se guardan totales; no se guarda la IP.

const PROVINCIAS_AR: Record<string, string> = {
	A: 'Salta', B: 'Buenos Aires', C: 'Ciudad de Buenos Aires', D: 'San Luis', E: 'Entre Ríos',
	F: 'La Rioja', G: 'Santiago del Estero', H: 'Chaco', J: 'San Juan', K: 'Catamarca',
	L: 'La Pampa', M: 'Mendoza', N: 'Misiones', P: 'Formosa', Q: 'Neuquén', R: 'Río Negro',
	S: 'Santa Fe', T: 'Tucumán', U: 'Chubut', V: 'Tierra del Fuego', W: 'Corrientes',
	X: 'Córdoba', Y: 'Jujuy', Z: 'Santa Cruz',
};

export function esRobot(ua: string): boolean {
	return !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp\/|telegrambot/i.test(ua);
}

function nombrePais(codigo: string): string {
	if (!codigo || codigo === 'XX') return 'Sin dato';
	try {
		return new Intl.DisplayNames(['es'], { type: 'region' }).of(codigo.toUpperCase()) ?? codigo;
	} catch {
		return codigo;
	}
}

export function origen(ref: string, utm: string, ua: string, hostPropio: string): string {
	const u = (utm || '').toLowerCase();
	if (u) {
		if (/whats/.test(u)) return 'WhatsApp';
		if (/brevo|news|boletin|mail/.test(u)) return 'Boletín por mail';
		if (/face|fb/.test(u)) return 'Facebook';
		if (/insta/.test(u)) return 'Instagram';
		if (/telegram/.test(u)) return 'Telegram';
		if (/^(x|twitter)$/.test(u)) return 'X (Twitter)';
		return 'Campaña: ' + u;
	}
	let host = '';
	try {
		host = ref ? new URL(ref).hostname.replace(/^www\./, '') : '';
	} catch {
		host = '';
	}
	if (!host) {
		if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook';
		if (/Instagram/.test(ua)) return 'Instagram';
		return 'Sin origen (WhatsApp, apps, favoritos o tipeado)';
	}
	if (host === hostPropio.replace(/^www\./, '')) return 'Dentro del diario';
	if (/news\.google\./.test(host)) return 'Google Noticias';
	if (/(^|\.)google\./.test(host)) return 'Google';
	if (/bing\.com$/.test(host)) return 'Bing';
	if (/duckduckgo/.test(host)) return 'DuckDuckGo';
	if (/yahoo\./.test(host)) return 'Yahoo';
	if (/facebook\.com$|fb\.me$/.test(host)) return 'Facebook';
	if (/instagram\.com$/.test(host)) return 'Instagram';
	if (/^t\.co$|twitter\.com$|^x\.com$/.test(host)) return 'X (Twitter)';
	if (/whatsapp|wa\.me/.test(host)) return 'WhatsApp';
	if (/^t\.me$|telegram/.test(host)) return 'Telegram';
	if (/linkedin|lnkd\.in/.test(host)) return 'LinkedIn';
	if (/youtube\.com$|youtu\.be$/.test(host)) return 'YouTube';
	if (/threads\.net$/.test(host)) return 'Threads';
	if (/mail\.google|outlook|live\.com|yahoo\.mail/.test(host)) return 'Mail';
	if (/chatgpt|openai|perplexity|claude\.ai|gemini/.test(host)) return 'Asistentes de IA';
	return 'Otro sitio: ' + host;
}

export function dispositivo(ua: string): string {
	if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
	if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'Celular';
	return 'Computadora';
}

export function sistema(ua: string): string {
	if (/Android/i.test(ua)) return 'Android';
	if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
	if (/Windows/i.test(ua)) return 'Windows';
	if (/CrOS/i.test(ua)) return 'ChromeOS';
	if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
	if (/Linux/i.test(ua)) return 'Linux';
	return 'Otro';
}

export function navegador(ua: string): string {
	if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Dentro de Facebook';
	if (/Instagram/.test(ua)) return 'Dentro de Instagram';
	if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
	if (/Edg\//.test(ua)) return 'Edge';
	if (/OPR\/|Opera/.test(ua)) return 'Opera';
	if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
	if (/CriOS|Chrome/.test(ua)) return 'Chrome';
	if (/Safari/.test(ua)) return 'Safari';
	return 'Otro';
}

export function lugar(headers: Headers): { pais: string; provincia: string; ciudad: string } {
	const cc = (headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || '').toUpperCase();
	const region = headers.get('x-vercel-ip-country-region') || '';
	let ciudad = headers.get('x-vercel-ip-city') || '';
	try {
		ciudad = decodeURIComponent(ciudad);
	} catch {}
	const pais = nombrePais(cc);
	const provincia = !region ? 'Sin dato' : cc === 'AR' ? PROVINCIAS_AR[region.toUpperCase()] ?? region : `${region} (${pais})`;
	return { pais, provincia, ciudad: ciudad ? (cc === 'AR' ? ciudad : `${ciudad} (${pais})`) : 'Sin dato' };
}

export function seccionDeRuta(ruta: string): string {
	if (ruta === '/' || ruta === '') return 'Portada';
	const primera = ruta.split('/').filter(Boolean)[0] || '';
	if (primera === 'articulo') return 'Notas';
	return primera.charAt(0).toUpperCase() + primera.slice(1).replace(/-/g, ' ');
}

export function normalizarRuta(r: string): string {
	let ruta = String(r || '/').split(/[?#]/)[0];
	try {
		ruta = decodeURI(ruta);
	} catch {}
	if (!ruta.startsWith('/')) ruta = '/' + ruta;
	if (ruta.length > 1) ruta = ruta.replace(/\/+$/, '');
	return ruta.slice(0, 160);
}

export function horaArgentina(): string {
	const h = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours();
	return String(h).padStart(2, '0') + ' h';
}

export function diaSemana(): string {
	const d = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCDay();
	return ['7 · domingo', '1 · lunes', '2 · martes', '3 · miércoles', '4 · jueves', '5 · viernes', '6 · sábado'][d];
}

export function idioma(headers: Headers): string {
	const l = (headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
	return l || 'Sin dato';
}
