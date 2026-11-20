const LUMINANCE_BITS = 63;

function decodeBase64(text: string): number[] | undefined {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const character of text.replace(/=+$/, '')) {
		const value = alphabet.indexOf(character);

		if (value < 0) return undefined;

		buffer = (buffer << 6) | value;
		bits += 6;

		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return bytes;
}

/**
 * @description Reads an image's average lightness from its ThumbHash, the `placeholder` Discord sends with each
 * attachment, without decoding the hash.
 * @param placeholder The base64 ThumbHash.
 * @returns The lightness from 0 (black) to 1 (white), or `undefined` when the hash is not one.
 */
export function placeholderLightness(placeholder: string): number | undefined {
	const bytes = decodeBase64(placeholder);

	if (!bytes || bytes.length < 5) return undefined;

	return (bytes[0]! & LUMINANCE_BITS) / LUMINANCE_BITS;
}

export default { placeholderLightness };
