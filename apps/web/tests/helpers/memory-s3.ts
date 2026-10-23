/**
 * @description Serves an in-memory object store answering the path-style requests `Bun.S3Client` and
 * presigned uploads make, for tests that publish without MinIO.
 * @returns The running server; pass its `url.href` as `S3_ENDPOINT`.
 */
export function serveMemoryS3() {
	const objects = new Map<string, ArrayBuffer>();

	return Bun.serve({
		port: 0,
		async fetch(request) {
			const key = new URL(request.url).pathname;

			if (request.method === 'PUT') {
				objects.set(key, await request.arrayBuffer());

				return new Response(null);
			}

			if (request.method === 'DELETE') {
				objects.delete(key);

				return new Response(null, { status: 204 });
			}

			const body = objects.get(key);

			if (!body) {
				return new Response(null, { status: 404 });
			}

			return new Response(request.method === 'HEAD' ? null : body, {
				headers: { 'content-length': String(body.byteLength) },
			});
		},
	});
}

export default serveMemoryS3;
