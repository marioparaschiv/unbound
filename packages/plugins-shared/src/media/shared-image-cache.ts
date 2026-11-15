import { fs } from '@unbound-app/api';

import { createImageCache, type ImageCache, type ImageCacheIO } from './image-cache';

const SHARED_KEY = '__unboundImageCache1';

const documentsIO: ImageCacheIO = {
	async download(url) {
		if (!url.startsWith('https://')) return null;

		const response = await fetch(url);

		return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
	},
	async read(path) {
		return (await fs.exists(path))
			? fs.readFile(path, path.endsWith('.json') ? 'utf8' : 'base64')
			: null;
	},
	async write(path, content, encoding) {
		await fs.writeFile(path, content, encoding);
	},
	async remove(path) {
		await fs.removeFile(path);
	},
};

/**
 * @description Returns the image cache every plugin shares in this runtime, in `Unbound/Cache/Images`, creating it on first use.
 * @returns The shared cache.
 */
export function sharedImageCache(): ImageCache {
	const existing = Reflect.get(globalThis, SHARED_KEY) as ImageCache | undefined;

	if (existing) return existing;

	const cache = createImageCache(documentsIO);

	Reflect.set(globalThis, SHARED_KEY, cache);

	return cache;
}
