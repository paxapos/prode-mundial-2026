/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself (JS/CSS)
	...files  // everything in `static` (images, manifest, etc.)
];

self.addEventListener('install', (event: any) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event: any) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

const ASSET_SET = new Set(ASSETS);

self.addEventListener('fetch', (event: any) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Solo manejamos nuestros assets estáticos (build + files): versionados e inmutables.
	// Se sirven cache-first → carga instantánea y offline del shell de la app.
	//
	// Todo lo demás (navegaciones HTML/SSR y APIs) NO lo tocamos: lo maneja el navegador
	// por red. Esto evita cachear y re-servir páginas autenticadas de un usuario a otro
	// en el mismo dispositivo, y además quita overhead del SW en cada navegación.
	const isOwnStaticAsset = url.origin === self.location.origin && ASSET_SET.has(url.pathname);
	if (!isOwnStaticAsset) return;

	async function respond() {
		const cache = await caches.open(CACHE);
		const cached = await cache.match(url.pathname);
		if (cached) return cached;

		// No estaba pre-cacheado: traelo de red y guardalo (es inmutable y versionado).
		const response = await fetch(event.request);
		if (response.status === 200) cache.put(url.pathname, response.clone());
		return response;
	}

	event.respondWith(respond());
});
