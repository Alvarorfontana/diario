import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atender, armarNota, leerFicha, limpiarHtml, trozosAHtml, youtubeId } from './telegram-bot.mjs';

const secciones = [{ id: 'internacional', nombre: 'Internacional' }, { id: 'argentina', nombre: 'Argentina' }, { id: 'economia', nombre: 'Economía' }];
const FICHA = 'SECCIÓN: Economía\nREGIÓN: Norte Grande\nVOLANTA: Crisis\nTÍTULO: Un título: con dos puntos\nBAJADA: Primera línea\nsegunda línea\nFIRMA: Emilio Lahitte\nCIUDAD: Corrientes\nEPÍGRAFE: El puerto. Foto: Prensa\nETIQUETAS: Política, Corrientes\nVIDEO: https://youtu.be/dQw4w9WgXcQ';

function contexto(extra = {}) {
	let sesion = null;
	const enviados = [];
	const notas = [];
	return {
		enviados, notas, usuarioId: '7', secciones,
		tg: async (metodo, datos) => { enviados.push({ metodo, ...datos }); return {}; },
		leerSesion: async () => (sesion ? JSON.parse(sesion) : null),
		guardarSesion: async (s) => { sesion = JSON.stringify(s); },
		descargar: async () => new Uint8Array([1, 2]),
		word: async () => '<p>Texto de <strong>Word</strong></p><p></p><img src="data:image/png;base64,AAAA"><script>x()</script>',
		subirFoto: async () => '/media/foto.jpg',
		guardarNota: async (s, borrador) => { notas.push({ raw: armarNota(s, secciones, borrador, '2026-11-05'), borrador }); return { slug: 'nota', url: 'https://x/articulo/nota/' }; },
		...extra,
	};
}
let id = 1;
const msg = (m, from = 7) => ({ update_id: id++, message: { chat: { id: from, type: 'private' }, from: { id: from }, ...m } });
const tecla = (data, from = 7) => ({ update_id: id++, callback_query: { id: 'q', data, from: { id: from }, message: { message_id: 1, chat: { id: from, type: 'private' } } } });
const ultimo = (c) => c.enviados.filter((e) => e.text).at(-1).text;

test('lee la ficha con acentos, varios renglones y dos puntos en el valor', () => {
	const f = leerFicha(FICHA);
	assert.equal(f.titulo, 'Un título: con dos puntos');
	assert.equal(f.bajada, 'Primera línea\nsegunda línea');
	assert.equal(f.seccion, 'Economía');
});

test('un texto cualquiera no es ficha', () => {
	assert.deepEqual(leerFicha('Hola, te mando la nota de hoy'), {});
});

test('reconoce enlaces de YouTube', () => {
	assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
	assert.equal(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
	assert.equal(youtubeId('https://vimeo.com/1'), null);
});

test('conserva párrafos, negritas que cruzan renglones, enlaces y escapa HTML', () => {
	const text = 'Uno <b> y dos\nSigue fuerte\n\n## Subtítulo\n- punto\nVer nota';
	const html = trozosAHtml([{ text, entities: [{ type: 'bold', offset: 6, length: 14 }, { type: 'text_link', offset: text.indexOf('nota'), length: 4, url: 'https://a.com/?x=1&y=2' }] }]);
	assert.match(html, /<p>Uno &lt;b<strong>&gt; y dos<\/strong><\/p>/);
	assert.match(html, /<p><strong>Sigue <\/strong>fuerte<\/p>/);
	assert.match(html, /<h2>Subtítulo<\/h2>/);
	assert.match(html, /<ul><li>punto<\/li><\/ul>/);
	assert.match(html, /<a href="https:\/\/a\.com\/\?x=1&amp;y=2">nota<\/a>/);
});

test('un párrafo que Telegram partió se vuelve a unir; párrafos terminados quedan separados', () => {
	const largo = `${'palabra '.repeat(500)}sin terminar`;
	assert.equal((trozosAHtml([{ text: largo }, { text: 'la frase.' }]).match(/<p>/g) || []).length, 1);
	assert.equal((trozosAHtml([{ text: 'Termina acá.' }, { text: 'Otro párrafo' }]).match(/<p>/g) || []).length, 2);
	assert.equal((trozosAHtml([{ text: 'Corto sin punto' }, { text: 'Otro párrafo' }]).match(/<p>/g) || []).length, 2);
});

test('negrita en el segundo trozo queda en su lugar', () => {
	const html = trozosAHtml([{ text: 'Primero.' }, { text: 'Hola mundo', entities: [{ type: 'bold', offset: 5, length: 5 }] }]);
	assert.match(html, /Hola <strong>mundo<\/strong>/);
});

test('limpia el HTML de Word', () => {
	assert.equal(limpiarHtml('<p>a</p><p> </p><img src="x"><script>y</script><a href="javascript:z">b</a>'), '<p>a</p><a>b</a>');
});

test('recorrido completo: ficha, foto, texto en dos partes, tildes y publicación', async () => {
	const c = contexto();
	await atender(msg({ text: FICHA }), c);
	assert.match(ultimo(c), /mandame el texto/i);
	await atender(msg({ photo: [{ file_id: 'chica' }, { file_id: 'grande' }] }), c);
	assert.match(ultimo(c), /Foto recibida/);
	await atender(msg({ text: 'Primer párrafo.', entities: [] }), c);
	await atender(msg({ text: 'Segundo párrafo.', entities: [] }), c);
	assert.match(ultimo(c), /4 palabras/);
	await atender(tecla('listo'), c);
	assert.match(ultimo(c), /Revisá la nota/);
	await atender(tecla('tapa'), c);
	await atender(tecla('publicar'), c);
	assert.equal(c.notas.length, 0, 'publicar pide confirmación');
	await atender(tecla('confirmar'), c);
	assert.equal(c.notas.length, 1);
	const { raw, borrador } = c.notas[0];
	assert.equal(borrador, false);
	for (const parte of ['title: "Un título: con dos puntos"', 'section: economia', 'region: norte-grande', 'author: Emilio Lahitte', 'ciudad: Corrientes', 'heroImage: /media/foto.jpg', 'imageCaption: "El puerto. Foto: Prensa"', 'tapa: true', 'pubDate: 2026-11-05', '<p>Primer párrafo.</p>', 'youtube-nocookie.com/embed/dQw4w9WgXcQ']) assert.ok(raw.includes(parte), parte);
	assert.ok(!raw.includes('draft: true'));
	assert.ok(!raw.includes('ultimoMomento'));
	assert.match(ultimo(c), /Publicada/);
	await atender(tecla('confirmar'), c);
	assert.equal(c.notas.length, 1, 'un segundo toque no publica de nuevo');
});

test('Word sin ficha: espera la ficha y después muestra la revisión', async () => {
	const c = contexto();
	await atender(msg({ document: { file_id: 'd', file_name: 'Nota.DOCX', file_size: 100 } }), c);
	assert.ok(c.enviados.some((e) => /Falta TÍTULO/.test(e.text || '')));
	await atender(msg({ text: 'SECCIÓN: Argentina\nTÍTULO: T\nBAJADA: B' }), c);
	assert.match(ultimo(c), /Revisá la nota/);
	await atender(tecla('borrador'), c);
	assert.ok(c.notas[0].raw.includes('draft: true'));
	assert.ok(c.notas[0].raw.includes('author: Redacción'));
	assert.ok(c.notas[0].raw.includes('<strong>Word</strong>'));
	assert.ok(!c.notas[0].raw.includes('data:image'));
	assert.ok(!c.notas[0].raw.includes('<script'));
});

test('sin epígrafe no publica, pero corrigiendo la línea sí', async () => {
	const c = contexto();
	await atender(msg({ text: 'SECCIÓN: Argentina\nTÍTULO: T\nBAJADA: B' }), c);
	await atender(msg({ photo: [{ file_id: 'f' }] }), c);
	await atender(msg({ text: 'Texto.' }), c);
	await atender(tecla('listo'), c);
	assert.match(ultimo(c), /FALTA EPÍGRAFE/);
	await atender(tecla('publicar'), c);
	assert.ok(c.enviados.some((e) => e.show_alert));
	await atender(msg({ text: 'EPÍGRAFE: El río. Foto: Archivo' }), c);
	await atender(tecla('publicar'), c);
	await atender(tecla('confirmar'), c);
	assert.equal(c.notas.length, 1);
});

test('rechaza datos que el sitio no aceptaría', async () => {
	const c = contexto();
	await atender(msg({ text: 'SECCIÓN: Farándula\nTÍTULO: T\nBAJADA: B\nVIDEO: https://vimeo.com/1' }), c);
	assert.match(ultimo(c), /No conozco la sección/);
	assert.match(ultimo(c), /enlace de YouTube/);
});

test('solo atiende a su dueño y no le contesta a nadie más', async () => {
	const c = contexto();
	await atender(msg({ text: FICHA }, 99), c);
	await atender(tecla('confirmar', 99), c);
	assert.equal(c.enviados.length, 0);
});

test('sin dueño configurado solo informa el número, sin tocar notas', async () => {
	const c = contexto({ usuarioId: undefined });
	await atender(msg({ text: FICHA }, 55), c);
	assert.match(ultimo(c), /55/);
	assert.equal(c.enviados.length, 1);
});

test('un mensaje repetido por Telegram no se procesa dos veces', async () => {
	const c = contexto();
	const u = msg({ text: FICHA });
	await atender(u, c);
	const n = c.enviados.length;
	await atender(u, c);
	assert.equal(c.enviados.length, n);
});

test('si falla el guardado avisa y la nota sigue en curso', async () => {
	let intentos = 0;
	const c = contexto();
	const real = c.guardarNota;
	c.guardarNota = async (...a) => { if (!intentos++) throw new Error('GitHub 500'); return real(...a); };
	await atender(msg({ text: 'SECCIÓN: Argentina\nTÍTULO: T\nBAJADA: B' }), c);
	await atender(msg({ text: 'Texto.' }), c);
	await atender(tecla('listo'), c);
	await atender(tecla('confirmar'), c);
	assert.match(ultimo(c), /Algo falló/);
	await atender(tecla('confirmar'), c);
	assert.equal(c.notas.length, 1);
});
