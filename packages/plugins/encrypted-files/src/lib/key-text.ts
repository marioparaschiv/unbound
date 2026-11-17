import nacl from 'tweetnacl';

const PREFIX = 'unbound-file-key:';
const KEY_TEXT = /unbound-file-key:([A-Za-z0-9+/]{43}=)/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * @description Encodes bytes as base64.
 * @param bytes The bytes.
 * @returns The base64 text.
 */
export function toBase64(bytes: Uint8Array): string {
	let out = '';

	for (let index = 0; index < bytes.length; index += 3) {
		const [a = 0, b = 0, c = 0] = [bytes[index], bytes[index + 1], bytes[index + 2]];
		const chunk = (a << 16) | (b << 8) | c;

		out += ALPHABET[(chunk >> 18) & 63]! + ALPHABET[(chunk >> 12) & 63]!;
		out += index + 1 < bytes.length ? ALPHABET[(chunk >> 6) & 63]! : '=';
		out += index + 2 < bytes.length ? ALPHABET[chunk & 63]! : '=';
	}

	return out;
}

/**
 * @description Decodes base64 text.
 * @param text The base64 text.
 * @returns The bytes.
 */
export function fromBase64(text: string): Uint8Array {
	const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
	const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
	let bits = 0;
	let value = 0;
	let index = 0;

	for (const char of clean) {
		value = (value << 6) | ALPHABET.indexOf(char);
		bits += 6;

		if (bits >= 8) {
			bits -= 8;
			out[index++] = (value >> bits) & 0xff;
		}
	}

	return out.subarray(0, index);
}

/**
 * @description Writes a public key as the text people share to receive encrypted files.
 * @param publicKey The public key.
 * @returns The shareable text.
 */
export function keyText(publicKey: Uint8Array): string {
	return `${PREFIX}${toBase64(publicKey)}`;
}

/**
 * @description Finds a shared public key in a message.
 * @param content The message text.
 * @returns The key, or `undefined` when the message holds none.
 */
export function readKeyText(content: string | undefined): Uint8Array | undefined {
	const match = content ? KEY_TEXT.exec(content) : null;
	const key = match ? fromBase64(match[1]!) : undefined;

	return key?.byteLength === nacl.box.publicKeyLength ? key : undefined;
}

/**
 * @description Shortens a key to a fingerprint people can compare out loud.
 * @param publicKey The public key.
 * @returns Eight groups of four hex digits from the key's hash.
 */
export function fingerprint(publicKey: Uint8Array): string {
	const digest = nacl.hash(publicKey).subarray(0, 16);
	const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');

	return hex.match(/.{4}/g)!.join(' ');
}
