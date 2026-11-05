// Bot de Telegram para cargar notas: una ficha con los datos, el texto pegado o en Word,
// y una vista previa con botones. La lógica no sabe nada de GitHub ni de Telegram: recibe
// esas operaciones en `ctx`, así se puede probar sin red (ver telegram-bot.test.mjs).
import sanitizeHtml from 'sanitize-html';
import { stringify } from 'yaml';
import { htmlParaArchivo } from './md.ts';

const CAMPOS = {
	seccion: 'seccion', region: 'region', volanta: 'volanta', titulo: 'titulo', bajada: 'bajada',
	firma: 'firma', autor: 'firma', ciudad: 'ciudad', epigrafe: 'epigrafe', etiquetas: 'etiquetas',
	video: 'video', puntos: 'puntos', 'puntos clave': 'puntos', resumen: 'resumen',
};
const OBLIGATORIOS = { seccion: 'SECCIÓN', titulo: 'TÍTULO', bajada: 'BAJADA' };
const REGIONES = {
	'norte grande': 'norte-grande', nea: 'norte-grande', noa: 'norte-grande', centro: 'centro', cuyo: 'cuyo',
	patagonia: 'patagonia', 'buenos aires': 'buenos-aires', nacional: 'nacional',
};
const LIMITE_MENSAJE = 3500; // desde acá se considera que Telegram partió el texto

export const PLANTILLA = `SECCIÓN: Argentina
REGIÓN: Norte Grande
VOLANTA:
TÍTULO:
BAJADA:
FIRMA: Emilio Lahitte
CIUDAD:
EPÍGRAFE:
ETIQUETAS:
VIDEO:`;

const AYUDA = `Para cargar una nota:

1. Copiá la plantilla de abajo, completala y mandámela. Solo son obligatorios SECCIÓN, TÍTULO y BAJADA.
2. Mandá la foto cuando quieras.
3. Cuando te lo pida, pegá el texto o mandame el archivo de Word (.docx).
4. Revisá la vista previa y elegí publicar o guardar como borrador.

También podés sumar PUNTOS: (hasta 3, uno por renglón) y RESUMEN: (para WhatsApp).
Si te equivocás en algo, en la vista previa mandá solo esa línea, por ejemplo TÍTULO: el nuevo título.

/nueva empieza de cero. /plantilla te manda la plantilla.`;

const sinAcentos = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esc = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const nuevaSesion = (ultimoUpdate = 0) => ({ ultimoUpdate, etapa: 'ficha', ficha: {}, foto: null, trozos: [], html: '', ultimo: false, tapa: false });
const textoPlano = (html) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const palabras = (html) => textoPlano(html).split(' ').filter(Boolean).length;

export const youtubeId = (url) => (String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/) || [])[1] || null;

export function slugify(v) {
	return sinAcentos(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90).replace(/-$/, '') || 'nota';
}

/** Lee las líneas CAMPO: valor. Lo que sigue sin campo se suma al anterior (una bajada en dos renglones). */
export function leerFicha(texto) {
	const campos = {};
	let actual = null;
	for (const linea of String(texto).split('\n')) {
		const m = linea.match(/^\s*\*{0,2}([\p{L} ]{3,14}):\*{0,2}\s*(.*)$/u);
		const clave = m ? CAMPOS[sinAcentos(m[1])] : null;
		if (clave) {
			actual = clave;
			campos[clave] = m[2].trim();
		} else if (actual && linea.trim()) {
			campos[actual] = `${campos[actual]}\n${linea.trim()}`.trim();
		}
	}
	return campos;
}

function valorSeccion(valor, secciones) {
	const n = sinAcentos(valor || '');
	if (n === 'politica' || n === 'nacional') return 'argentina';
	return secciones.find((s) => s.id === n || sinAcentos(s.nombre) === n)?.id || '';
}

function problemasFicha(ficha, secciones) {
	const lista = Object.entries(OBLIGATORIOS).filter(([k]) => !ficha[k]?.trim()).map(([, n]) => `Falta ${n}.`);
	if (ficha.seccion && !valorSeccion(ficha.seccion, secciones)) lista.push(`No conozco la sección "${ficha.seccion}". Usá: ${secciones.map((s) => s.nombre).join(', ')}.`);
	if (ficha.region && !REGIONES[sinAcentos(ficha.region)]) lista.push(`No conozco la región "${ficha.region}". Usá: Norte Grande, Centro, Cuyo, Patagonia, Buenos Aires o Nacional.`);
	if (ficha.video && !youtubeId(ficha.video)) lista.push('El VIDEO tiene que ser un enlace de YouTube.');
	return lista;
}

/** Aplica negritas, itálicas y enlaces de Telegram a un tramo. Las posiciones vienen en unidades UTF-16, igual que en JS. */
function tramoHtml(texto, desde, hasta, entidades) {
	const activas = entidades.filter((e) => e.offset < hasta && e.offset + e.length > desde && ['bold', 'italic', 'underline', 'strikethrough', 'text_link', 'url'].includes(e.type));
	const cortes = [...new Set([desde, hasta, ...activas.flatMap((e) => [e.offset, e.offset + e.length]).filter((p) => p > desde && p < hasta)])].sort((a, b) => a - b);
	let html = '';
	for (let i = 0; i < cortes.length - 1; i++) {
		const [a, b] = [cortes[i], cortes[i + 1]];
		let parte = esc(texto.slice(a, b));
		for (const e of activas.filter((x) => x.offset <= a && x.offset + x.length >= b)) {
			if (e.type === 'bold') parte = `<strong>${parte}</strong>`;
			if (e.type === 'italic') parte = `<em>${parte}</em>`;
			if (e.type === 'underline') parte = `<u>${parte}</u>`;
			if (e.type === 'strikethrough') parte = `<s>${parte}</s>`;
			const href = e.type === 'text_link' ? e.url : e.type === 'url' ? texto.slice(e.offset, e.offset + e.length) : '';
			if (/^https?:\/\//i.test(href)) parte = `<a href="${href.replace(/"/g, '%22').replace(/&/g, '&amp;')}">${parte}</a>`;
		}
		html += parte;
	}
	return html;
}

/** Une lo que Telegram partió: si un trozo largo termina a mitad de frase, sigue el mismo párrafo. */
function unirTrozos(trozos) {
	let texto = '';
	const entidades = [];
	trozos.forEach((t, i) => {
		if (i) {
			const partido = trozos[i - 1].text.length >= LIMITE_MENSAJE && !/[.!?:»”")\]…]\s*$/.test(texto);
			texto += partido ? ' ' : '\n\n';
		}
		for (const e of t.entities || []) entidades.push({ ...e, offset: e.offset + texto.length });
		texto += t.text;
	});
	return { texto, entidades };
}

export function trozosAHtml(trozos) {
	const { texto, entidades } = unirTrozos(trozos);
	const salida = [];
	let lista = null;
	const cerrarLista = () => { if (lista) salida.push(`<ul>${lista.join('')}</ul>`); lista = null; };
	let pos = 0;
	for (const linea of texto.split('\n')) {
		const inicio = pos;
		const fin = pos + linea.length;
		pos = fin + 1;
		if (!linea.trim()) { cerrarLista(); continue; }
		const sangria = linea.length - linea.trimStart().length;
		const titulo = linea.trimStart().match(/^(#{2,3})\s+/);
		const vineta = linea.trimStart().match(/^[-•]\s+/);
		const salto = titulo?.[0].length || vineta?.[0].length || 0;
		const html = tramoHtml(texto, inicio + sangria + salto, fin, entidades);
		if (vineta) { (lista ||= []).push(`<li>${html}</li>`); continue; }
		cerrarLista();
		const cita = entidades.some((e) => (e.type === 'blockquote' || e.type === 'expandable_blockquote') && e.offset <= inicio && e.offset + e.length >= fin);
		if (titulo) salida.push(`<h${titulo[1].length}>${html}</h${titulo[1].length}>`);
		else if (cita) salida.push(`<blockquote><p>${html}</p></blockquote>`);
		else salida.push(`<p>${html}</p>`);
	}
	cerrarLista();
	return salida.join('\n');
}

export function limpiarHtml(html) {
	return sanitizeHtml(html, {
		allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
		allowedAttributes: { a: ['href'] },
		allowedSchemes: ['https', 'http', 'mailto'],
		exclusiveFilter: (f) => f.tag === 'p' && !f.text.trim(),
	}).trim();
}

const cuerpo = (s) => s.html || (s.trozos.length ? trozosAHtml(s.trozos) : '');

/** Arma el archivo de la nota con el mismo formato que guarda el panel /admin. */
export function armarNota(s, secciones, borrador, hoy) {
	const f = s.ficha;
	const fm = { title: f.titulo.trim() };
	if (f.volanta) fm.volanta = f.volanta;
	fm.description = f.bajada.trim();
	fm.section = valorSeccion(f.seccion, secciones);
	fm.author = f.firma?.trim() || 'Redacción';
	if (f.ciudad) fm.ciudad = f.ciudad.trim().slice(0, 60);
	if (f.region) fm.region = REGIONES[sinAcentos(f.region)];
	fm.pubDate = hoy;
	if (s.fotoUrl) fm.heroImage = s.fotoUrl;
	if (f.epigrafe) fm.imageCaption = f.epigrafe.trim();
	if (s.ultimo) fm.ultimoMomento = true;
	if (s.tapa) fm.tapa = true;
	if (borrador) fm.draft = true;
	fm.tags = (f.etiquetas || '').split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
	const puntos = (f.puntos || '').split('\n').map((p) => p.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 3);
	if (puntos.length) fm.puntosClave = puntos;
	if (f.resumen) fm.resumenCompartir = f.resumen.trim().slice(0, 140);
	let html = cuerpo(s);
	const video = f.video && youtubeId(f.video);
	if (video) html += `\n<figure class="video"><iframe src="https://www.youtube-nocookie.com/embed/${video}" title="Video de YouTube" loading="lazy" allowfullscreen></iframe></figure>`;
	return `---\n${stringify(fm, { lineWidth: 0 })}---\n\n${htmlParaArchivo(html)}\n`;
}

const boton = (text, callback_data) => ({ text, callback_data });
function tecladoRevision(s) {
	return { inline_keyboard: [
		[boton(`${s.ultimo ? '✅' : '⬜'} Último momento`, 'ultimo'), boton(`${s.tapa ? '✅' : '⬜'} Tapa`, 'tapa')],
		[boton('🟢 Publicar', 'publicar'), boton('📝 Borrador', 'borrador')],
		[boton('✖️ Descartar', 'descartar')],
	] };
}

function textoRevision(s, secciones) {
	const f = s.ficha;
	const seccion = secciones.find((x) => x.id === valorSeccion(f.seccion, secciones))?.nombre;
	const plano = textoPlano(cuerpo(s));
	const lineas = [
		'<b>Revisá la nota</b>', '',
		f.volanta ? `<i>${esc(f.volanta)}</i>` : '',
		`<b>${esc(f.titulo)}</b>`,
		esc(f.bajada.slice(0, 400)), '',
		`Sección: ${esc(seccion)}${f.region ? ` · Región: ${esc(f.region)}` : ''}`,
		`Firma: ${esc(f.firma?.trim() || 'Redacción')}${f.ciudad ? ` (${esc(f.ciudad)})` : ''}`,
		`Texto: ${palabras(cuerpo(s))} palabras`,
		`Empieza: «${esc(plano.slice(0, 110))}…»`,
		`Termina: «…${esc(plano.slice(-110))}»`,
		`Foto: ${s.foto ? (f.epigrafe ? 'sí, con epígrafe' : '⚠️ sí, FALTA EPÍGRAFE') : 'sin foto'}`,
		`Video: ${f.video ? 'sí' : 'no'}`, '',
		'Para corregir, mandá la línea que cambia, por ejemplo TÍTULO: otro título.',
	];
	return lineas.filter((l, i) => l !== '' || lineas[i - 1] !== '').join('\n');
}

async function mostrarRevision(s, ctx, chat) {
	s.etapa = 'revision';
	await ctx.tg('sendMessage', { chat_id: chat, text: textoRevision(s, ctx.secciones), parse_mode: 'HTML', reply_markup: tecladoRevision(s) });
}

/** Lleva la nota al paso que le toque y avisa qué falta. */
async function avanzar(s, ctx, chat) {
	const problemas = problemasFicha(s.ficha, ctx.secciones);
	if (problemas.length) {
		s.etapa = 'ficha';
		await ctx.tg('sendMessage', { chat_id: chat, text: `${problemas.join('\n')}\n\nMandame solo esa línea, por ejemplo TÍTULO: el título.` });
		return;
	}
	if (cuerpo(s)) return mostrarRevision(s, ctx, chat);
	s.etapa = 'texto';
	await ctx.tg('sendMessage', { chat_id: chat, text: 'Ficha lista. Ahora mandame el texto: pegalo acá en uno o varios mensajes, o mandá el archivo de Word (.docx). Cuando termines, tocá Texto listo.' });
}

async function recibirArchivo(m, s, ctx, chat) {
	const doc = m.document;
	const nombre = (doc.file_name || '').toLowerCase();
	if (doc.file_size > 20_000_000) return ctx.tg('sendMessage', { chat_id: chat, text: 'El archivo pesa más de 20 MB y Telegram no me deja bajarlo.' });
	if (nombre.endsWith('.docx') || nombre.endsWith('.txt')) {
		const bytes = await ctx.descargar(doc.file_id);
		const html = nombre.endsWith('.docx') ? limpiarHtml(await ctx.word(bytes)) : trozosAHtml([{ text: new TextDecoder().decode(bytes) }]);
		if (!textoPlano(html)) return ctx.tg('sendMessage', { chat_id: chat, text: 'El archivo llegó vacío. Fijate y mandalo de nuevo.' });
		s.html = html;
		s.trozos = [];
		await ctx.tg('sendMessage', { chat_id: chat, text: `Texto recibido: ${palabras(html)} palabras.` });
		return avanzar(s, ctx, chat);
	}
	return ctx.tg('sendMessage', { chat_id: chat, text: 'Ese formato no lo puedo leer. Guardalo como Word (.docx) o pegá el texto acá.' });
}

async function recibirMensaje(m, s, ctx) {
	const chat = m.chat.id;
	const texto = m.text ?? m.caption ?? '';
	const comando = m.text?.match(/^\/(\w+)/)?.[1];

	if (comando === 'start' || comando === 'ayuda') {
		await ctx.tg('sendMessage', { chat_id: chat, text: AYUDA });
		await ctx.tg('sendMessage', { chat_id: chat, text: PLANTILLA });
		return;
	}
	if (comando === 'plantilla') return ctx.tg('sendMessage', { chat_id: chat, text: PLANTILLA });
	if (comando === 'nueva' || comando === 'cancelar') {
		Object.assign(s, nuevaSesion(s.ultimoUpdate));
		await ctx.tg('sendMessage', { chat_id: chat, text: 'Empezamos de cero. Mandame la ficha.' });
		return ctx.tg('sendMessage', { chat_id: chat, text: PLANTILLA });
	}
	if (m.video || m.video_note || m.animation) {
		return ctx.tg('sendMessage', { chat_id: chat, text: 'Los videos van por YouTube: subilo ahí y mandame VIDEO: con el enlace.' });
	}

	const foto = m.photo?.at(-1) || (m.document?.mime_type?.startsWith('image/') ? m.document : null);
	if (foto) {
		if (foto.file_size > 20_000_000) return ctx.tg('sendMessage', { chat_id: chat, text: 'La foto pesa más de 20 MB y Telegram no me deja bajarla.' });
		s.foto = { file_id: foto.file_id };
		const campos = leerFicha(texto);
		Object.assign(s.ficha, campos);
		if (s.etapa === 'revision') return mostrarRevision(s, ctx, chat);
		await ctx.tg('sendMessage', { chat_id: chat, text: 'Foto recibida.' });
		if (Object.keys(campos).length) return avanzar(s, ctx, chat);
		return;
	}
	if (m.document) return recibirArchivo(m, s, ctx, chat);
	if (!m.text) return;

	if (s.etapa === 'texto') {
		s.trozos.push({ text: m.text, entities: m.entities || [] });
		const reply_markup = { inline_keyboard: [[boton('✅ Texto listo', 'listo')]] };
		return ctx.tg('sendMessage', { chat_id: chat, text: `Recibido: ${palabras(trozosAHtml(s.trozos))} palabras en total. Si hay más, seguí mandando.`, reply_markup });
	}
	const campos = leerFicha(m.text);
	if (Object.keys(campos).length) {
		Object.assign(s.ficha, campos);
		return avanzar(s, ctx, chat);
	}
	return ctx.tg('sendMessage', { chat_id: chat, text: s.etapa === 'revision'
		? 'Para corregir mandá la línea que cambia, por ejemplo TÍTULO: otro título. Para terminar usá los botones de la vista previa.'
		: 'No encontré datos de la ficha. Completá esta plantilla y mandámela:' })
		.then(() => (s.etapa === 'ficha' ? ctx.tg('sendMessage', { chat_id: chat, text: PLANTILLA }) : undefined));
}

async function guardar(s, ctx, chat, borrador) {
	if (s.foto && !s.fotoUrl) s.fotoUrl = await ctx.subirFoto(await ctx.descargar(s.foto.file_id));
	const res = await ctx.guardarNota(s, borrador);
	await ctx.tg('sendMessage', { chat_id: chat, text: borrador
		? `Borrador guardado. Lo terminás en /admin. No aparece en el sitio. Archivo: ${res.slug}`
		: `Publicada. Va a aparecer cuando termine de actualizarse el sitio, en un par de minutos:\n${res.url}` });
	Object.assign(s, nuevaSesion(s.ultimoUpdate));
}

async function recibirBoton(q, s, ctx) {
	const chat = q.message.chat.id;
	const accion = q.data;
	const responder = (text) => ctx.tg('answerCallbackQuery', { callback_query_id: q.id, ...(text ? { text, show_alert: true } : {}) });

	if (accion === 'listo') {
		await responder();
		if (s.etapa !== 'texto') return;
		return avanzar(s, ctx, chat);
	}
	if (s.etapa !== 'revision') return responder('Esa vista previa ya no está activa.');

	if (accion === 'ultimo' || accion === 'tapa') {
		s[accion] = !s[accion];
		await responder();
		return ctx.tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: tecladoRevision(s) });
	}
	if (accion === 'descartar') {
		await responder();
		Object.assign(s, nuevaSesion(s.ultimoUpdate));
		return ctx.tg('sendMessage', { chat_id: chat, text: 'Nota descartada. No se guardó nada.' });
	}
	if (accion === 'publicar') {
		if (s.foto && !s.ficha.epigrafe?.trim()) return responder('Falta el epígrafe de la foto. Mandá EPÍGRAFE: qué muestra. Foto: fuente.');
		await responder();
		return ctx.tg('sendMessage', { chat_id: chat, text: `¿Publicar ya?\n«${s.ficha.titulo}»`, reply_markup: { inline_keyboard: [[boton('🟢 Sí, publicar', 'confirmar'), boton('Volver', 'volver')]] } });
	}
	if (accion === 'volver') return responder();
	if (accion === 'confirmar' || accion === 'borrador') {
		await responder();
		return guardar(s, ctx, chat, accion === 'borrador');
	}
	return responder();
}

/** Atiende una actualización de Telegram. Devuelve la sesión si hay que guardarla. */
export async function atender(update, ctx) {
	const m = update.message;
	const q = update.callback_query;
	const origen = m?.from?.id ?? q?.from?.id;
	const chat = m?.chat ?? q?.message?.chat;
	if (!origen || !chat || chat.type !== 'private') return null;

	if (!ctx.usuarioId) {
		await ctx.tg('sendMessage', { chat_id: chat.id, text: `Tu número de Telegram es ${origen}. Cargalo en Vercel como TELEGRAM_USUARIO_ID.` });
		return null;
	}
	if (String(origen) !== String(ctx.usuarioId)) return null; // solo atiende a su dueño, y a nadie más le contesta

	const s = { ...nuevaSesion(), ...((await ctx.leerSesion()) || {}) };
	if (update.update_id <= s.ultimoUpdate) return null; // Telegram reenvía si tardamos en contestar
	s.ultimoUpdate = update.update_id;
	try {
		if (m) await recibirMensaje(m, s, ctx);
		else await recibirBoton(q, s, ctx);
	} catch (e) {
		await ctx.tg('sendMessage', { chat_id: chat.id, text: 'Algo falló y no pude terminar. Tu nota sigue acá: probá de nuevo o tocá el botón otra vez.' }).catch(() => {});
		ctx.registrar?.(e);
	}
	await ctx.guardarSesion(s);
	return s;
}
