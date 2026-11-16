const MAX_BYTES = 5 * 1024 * 1024;
const cache = new Map<string, Uint8Array>();

/**
 * @description Downloads a sound file once per session and keeps its bytes for later plays.
 * @param url The file's link.
 * @returns The bytes, or `undefined` when the download failed or the file is over 5 MB.
 */
export async function downloadSound(url: string): Promise<Uint8Array | undefined> {
	const cached = cache.get(url);

	if (cached) return cached;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			logger.warn(`Failed to download sound ${url}: HTTP ${response.status}`);

			return undefined;
		}

		const bytes = new Uint8Array(await response.arrayBuffer());

		if (bytes.byteLength > MAX_BYTES) {
			logger.warn(`Failed to use sound ${url}: it is over 5 MB.`);

			return undefined;
		}

		cache.set(url, bytes);

		return bytes;
	} catch (error) {
		logger.error(`Failed to download sound ${url}:`, error);

		return undefined;
	}
}

/**
 * @description Writes bytes as base64, the form `fs.writeFile` takes binary data in.
 * @param bytes The bytes.
 * @returns The base64 text.
 */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';

	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}

	return btoa(binary);
}

export default { downloadSound, toBase64 };
