import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBlogPostImageById } from '$lib/server/state';

export const GET: RequestHandler = async ({ params, request }) => {
	const image = await getBlogPostImageById(params.postId);
	if (!image) throw error(404, 'Imagen no encontrada.');

	const updatedAtMs = Date.parse(image.updatedAt);
	const cacheVersion = Number.isFinite(updatedAtMs) ? String(updatedAtMs) : String(image.updatedAt.length);
	const lastModified = Number.isFinite(updatedAtMs) ? new Date(updatedAtMs).toUTCString() : null;
	const requestUrl = new URL(request.url);
	const isVersioned = requestUrl.searchParams.has('v');
	const etag = `W/"blog-image-${params.postId}-${cacheVersion}"`;
	const cacheControl = isVersioned
		? 'public, max-age=31536000, immutable'
		: 'public, max-age=86400, stale-while-revalidate=604800';
	const headers = new Headers({
		'Content-Type': image.contentType,
		'Content-Length': String(image.bytes.byteLength),
		'Cache-Control': cacheControl,
		ETag: etag,
		'X-Content-Type-Options': 'nosniff'
	});
	if (lastModified) headers.set('Last-Modified', lastModified);

	const ifNoneMatch = request.headers.get('if-none-match');
	if (ifNoneMatch?.split(',').map((value) => value.trim()).includes(etag)) {
		return new Response(null, { status: 304, headers });
	}

	const ifModifiedSince = request.headers.get('if-modified-since');
	if (
		!ifNoneMatch &&
		lastModified &&
		ifModifiedSince &&
		Math.floor(Date.parse(ifModifiedSince) / 1000) >= Math.floor(updatedAtMs / 1000)
	) {
		return new Response(null, { status: 304, headers });
	}

	return new Response(new Blob([new Uint8Array(image.bytes)], { type: image.contentType }), { headers });
};