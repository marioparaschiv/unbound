/**
 * @description Decodes UTF-8 bytes, replacing malformed sequences with U+FFFD.
 * @param bytes The bytes.
 * @returns The text.
 */
export function utf8(bytes: Uint8Array): string {
	let text = '';
	let index = 0;

	while (index < bytes.length) {
		const lead = bytes[index++]!;
		const extra = lead >= 0xf0 ? 3 : lead >= 0xe0 ? 2 : lead >= 0xc0 ? 1 : 0;
		let point = extra ? lead & (0x3f >> extra) : lead;

		for (let follow = 0; follow < extra; follow++) {
			point = (point << 6) | ((bytes[index++] ?? 0) & 0x3f);
		}

		text += lead >= 0x80 && lead < 0xc0 ? '�' : String.fromCodePoint(point);
	}

	return text;
}

/**
 * @description Decodes Latin-1 bytes.
 * @param bytes The bytes.
 * @returns The text.
 */
export function latin1(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

/**
 * @description Decodes UTF-16 bytes, reading a byte-order mark when present and big-endian otherwise.
 * @param bytes The bytes.
 * @param bigEndian The byte order when there is no mark.
 * @returns The text.
 */
export function utf16(bytes: Uint8Array, bigEndian = true): string {
	let start = 0;
	let big = bigEndian;

	if (bytes[0] === 0xff && bytes[1] === 0xfe) {
		big = false;
		start = 2;
	} else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
		big = true;
		start = 2;
	}

	const units: number[] = [];

	for (let index = start; index + 1 < bytes.length; index += 2) {
		units.push(
			big
				? (bytes[index]! << 8) | bytes[index + 1]!
				: bytes[index]! | (bytes[index + 1]! << 8),
		);
	}

	return String.fromCharCode(...units);
}

/**
 * @description Encodes bytes as base64.
 * @param bytes The bytes.
 * @returns The base64 text.
 */
export function base64(bytes: Uint8Array): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let text = '';

	for (let index = 0; index < bytes.length; index += 3) {
		const [a = 0, b = 0, c = 0] = [bytes[index], bytes[index + 1], bytes[index + 2]];
		const triple = (a << 16) | (b << 8) | c;

		text += alphabet[(triple >> 18) & 63]! + alphabet[(triple >> 12) & 63]!;
		text += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63]! : '=';
		text += index + 2 < bytes.length ? alphabet[triple & 63]! : '=';
	}

	return text;
}
