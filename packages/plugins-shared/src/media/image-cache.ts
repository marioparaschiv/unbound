/** Reads and writes for the image cache: downloads, and base64 files under the cache folder. */
export type ImageCacheIO = {
	download(url: string): Promise<Uint8Array | null>;
	read(path: string): Promise<string | null>;
	write(path: string, content: string, encoding: 'base64' | 'utf8'): Promise<void>;
	remove(path: string): Promise<void>;
};

/** How much the cache keeps: decoded entries in memory, and bytes on disk. */
export type ImageCacheLimits = { memoryEntries: number; diskBytes: number };

/** Image bytes shared by every plugin: from memory, then disk, then the network. */
export type ImageCache = {
	/** The image's bytes, or `null` when it cannot be downloaded. */
	bytes(url: string): Promise<Uint8Array | null>;
};

type IndexEntry = { url: string; size: number; used: number };

const CACHE_FOLDER = 'Unbound/Cache/Images';
const INDEX_PATH = `${CACHE_FOLDER}/index.json`;
const DEFAULT_LIMITS: ImageCacheLimits = { memoryEntries: 64, diskBytes: 64 * 1024 * 1024 };

/**
 * @description Names an image's cache file from its URL with two FNV-1a hashes.
 * @param url The image URL.
 * @returns A 16-character hex key.
 */
export function imageKey(url: string): string {
	let first = 0x811c9dc5;
	let second = 0x01000193;

	for (let index = 0; index < url.length; index++) {
		const code = url.charCodeAt(index);

		first = Math.imul(first ^ code, 0x01000193) >>> 0;
		second = Math.imul(second ^ code, 0x811c9dc5) >>> 0;
	}

	return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';

	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}

	return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
	const binary = atob(text);

	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readIndex(text: string | null): Map<string, IndexEntry> {
	try {
		const parsed: Record<string, IndexEntry> = text ? JSON.parse(text) : {};

		return new Map(Object.entries(parsed));
	} catch {
		// A damaged index only costs downloads; the files it named are overwritten as they come back.
		return new Map();
	}
}

/**
 * @description Creates an image cache over the given reads and writes, evicting the least recently used images past the limits.
 * @param io The downloads and file operations.
 * @param limits How many decoded images stay in memory and how many bytes stay on disk.
 * @returns The cache.
 */
export function createImageCache(
	io: ImageCacheIO,
	limits: ImageCacheLimits = DEFAULT_LIMITS,
): ImageCache {
	const memory = new Map<string, Uint8Array>();
	const pending = new Map<string, Promise<Uint8Array | null>>();
	let index: Promise<Map<string, IndexEntry>> | undefined;
	let clock = 0;

	function remember(url: string, bytes: Uint8Array) {
		memory.delete(url);
		memory.set(url, bytes);

		while (memory.size > limits.memoryEntries) memory.delete(memory.keys().next().value!);
	}

	async function store(
		entries: Map<string, IndexEntry>,
		key: string,
		url: string,
		bytes: Uint8Array,
	) {
		await io.write(`${CACHE_FOLDER}/${key}`, toBase64(bytes), 'base64');
		entries.set(key, { url, size: bytes.length, used: ++clock });

		let total = [...entries.values()].reduce((sum, entry) => sum + entry.size, 0);
		const oldestFirst = [...entries.entries()].sort(([, a], [, b]) => a.used - b.used);

		for (const [oldKey, entry] of oldestFirst) {
			if (total <= limits.diskBytes || oldKey === key) break;

			entries.delete(oldKey);
			total -= entry.size;
			await io.remove(`${CACHE_FOLDER}/${oldKey}`);
		}

		await io.write(INDEX_PATH, JSON.stringify(Object.fromEntries(entries)), 'utf8');
	}

	async function load(url: string): Promise<Uint8Array | null> {
		index ??= io.read(INDEX_PATH).then(readIndex);
		const entries = await index;
		const key = imageKey(url);
		const cached = entries.get(key);

		if (cached?.url === url) {
			const text = await io.read(`${CACHE_FOLDER}/${key}`);

			if (text) {
				cached.used = ++clock;

				return fromBase64(text);
			}
		}

		const bytes = await io.download(url);

		if (bytes) await store(entries, key, url, bytes);

		return bytes;
	}

	return {
		bytes(url) {
			const hit = memory.get(url);

			if (hit) {
				remember(url, hit);

				return Promise.resolve(hit);
			}

			const loading =
				pending.get(url) ??
				load(url)
					.then((bytes) => {
						if (bytes) remember(url, bytes);

						return bytes;
					})
					.finally(() => pending.delete(url));

			pending.set(url, loading);

			return loading;
		},
	};
}
