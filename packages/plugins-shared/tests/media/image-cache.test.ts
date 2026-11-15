import { describe, expect, test } from 'bun:test';

import { createImageCache, imageKey, type ImageCacheIO } from '~/media/image-cache';

function memoryIO(images: Record<string, number[]>) {
	const files = new Map<string, string>();
	const downloads: string[] = [];
	const io: ImageCacheIO = {
		download: async (url) => {
			downloads.push(url);

			return images[url] ? Uint8Array.from(images[url]) : null;
		},
		read: async (path) => files.get(path) ?? null,
		write: async (path, content) => void files.set(path, content),
		remove: async (path) => void files.delete(path),
	};

	return { io, files, downloads };
}

describe('imageKey', () => {
	test('is stable and differs between URLs', () => {
		expect(imageKey('https://cdn/a.png')).toBe(imageKey('https://cdn/a.png'));
		expect(imageKey('https://cdn/a.png')).not.toBe(imageKey('https://cdn/b.png'));
		expect(imageKey('https://cdn/a.png')).toHaveLength(16);
	});
});

describe('createImageCache', () => {
	test('downloads once, sharing a request in flight', async () => {
		const { io, downloads } = memoryIO({ 'https://cdn/a.png': [1, 2, 3] });
		const cache = createImageCache(io);
		const [first, second] = await Promise.all([
			cache.bytes('https://cdn/a.png'),
			cache.bytes('https://cdn/a.png'),
		]);

		expect([...first!]).toEqual([1, 2, 3]);
		expect(second).toBe(first);
		expect(downloads).toEqual(['https://cdn/a.png']);
	});

	test('a new cache reads the disk instead of downloading again', async () => {
		const { io, downloads } = memoryIO({ 'https://cdn/a.png': [4, 5] });

		await createImageCache(io).bytes('https://cdn/a.png');
		const bytes = await createImageCache(io).bytes('https://cdn/a.png');

		expect([...bytes!]).toEqual([4, 5]);
		expect(downloads).toHaveLength(1);
	});

	test('evicts the least recently used images past the disk limit', async () => {
		const { io, files } = memoryIO({
			'https://cdn/a.png': [1, 1, 1],
			'https://cdn/b.png': [2, 2, 2],
			'https://cdn/c.png': [3, 3, 3],
		});
		const cache = createImageCache(io, { memoryEntries: 8, diskBytes: 6 });

		await cache.bytes('https://cdn/a.png');
		await cache.bytes('https://cdn/b.png');
		await cache.bytes('https://cdn/c.png');

		expect(files.has(`Unbound/Cache/Images/${imageKey('https://cdn/a.png')}`)).toBe(false);
		expect(files.has(`Unbound/Cache/Images/${imageKey('https://cdn/c.png')}`)).toBe(true);
	});

	test('returns null for an image that cannot be downloaded', async () => {
		const { io, files } = memoryIO({});

		expect(await createImageCache(io).bytes('https://cdn/missing.png')).toBeNull();
		expect(files.size).toBe(0);
	});
});
