const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HEADER_BYTES = 5;

function decodeBase64(text: string): number[] | undefined {
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const character of text.replace(/=+$/, '')) {
		const value = BASE64_ALPHABET.indexOf(character);

		if (value < 0) {
			return undefined;
		}

		buffer = ((buffer << 6) | value) & 0xffffff;
		bits += 6;

		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return bytes;
}

function channelComponents(nx: number, ny: number): number {
	let count = 0;

	for (let cy = 0; cy < ny; cy++) {
		for (let cx = cy ? 0 : 1; cx * ny < nx * (ny - cy); cx++) {
			count++;
		}
	}

	return count;
}

/**
 * @description Says whether a base64 ThumbHash holds every component its header announces, as Discord's native decoder
 * reads them without bounds checks and traps on a short or garbled hash.
 * @param placeholder The base64 ThumbHash from an attachment or embed image.
 * @returns Whether the hash is complete.
 */
export function isValidThumbHash(placeholder: string): boolean {
	const hash = decodeBase64(placeholder);

	if (!hash || hash.length < HEADER_BYTES) {
		return false;
	}

	const header24 = hash[0] | (hash[1] << 8) | (hash[2] << 16);
	const header16 = hash[3] | (hash[4] << 8);
	const hasAlpha = (header24 >> 23) & 1;
	const isLandscape = (header16 >> 15) & 1;
	const lx = Math.max(3, isLandscape ? (hasAlpha ? 5 : 7) : header16 & 7);
	const ly = Math.max(3, isLandscape ? header16 & 7 : hasAlpha ? 5 : 7);
	const components =
		channelComponents(lx, ly) +
		2 * channelComponents(3, 3) +
		(hasAlpha ? channelComponents(5, 5) : 0);

	return hash.length >= (hasAlpha ? 6 : 5) + Math.ceil(components / 2);
}

export default { isValidThumbHash };
