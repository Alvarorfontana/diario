// Service worker de EL DIARIO: hace que el sitio se pueda instalar como app.
// Regla de oro: las noticias SIEMPRE se piden frescas a internet.
// Solo se guardan en el celular la página "sin conexión" y los archivos de diseño.
const VERSION = 'v1';
const CACHE = `eldiario-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	// Panel, API y analítica: nunca se tocan.
	if (/^\/(admin|api|keystatic|_vercel|comentarios)/.test(url.pathname)) return;

	// Páginas: siempre de internet; si no hay conexión, la página "sin conexión".
	if (req.mode === 'navigate') {
		event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
		return;
	}

	// Archivos de diseño con nombre único (/_astro/...): se guardan para cargar más rápido.
	if (url.pathname.startsWith('/_astro/')) {
		event.respondWith(
			caches.match(req).then(
				(hit) =>
					hit ||
					fetch(req).then((res) => {
						if (res.ok) {
							const copy = res.clone();
							caches.open(CACHE).then((c) => c.put(req, copy));
						}
						return res;
					}),
			),
		);
	}
});
