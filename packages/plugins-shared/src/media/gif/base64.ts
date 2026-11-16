const CHUNK = 0x8000;

/**
 * @description Decodes base64 into bytes.
 * @param text The base64 text.
 * @returns The bytes.
 */
export function fromBase64(text: string): Uint8Array {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);

	return bytes;
}

/**
 * @description Encodes bytes as base64.
 * @param bytes The bytes.
 * @returns The base64 text.
 */
export function toBase64(bytes: Uint8Array): string {
	let binary = '';

	for (let offset = 0; offset < bytes.length; offset += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
	}

	return btoa(binary);
}

export default { fromBase64, toBase64 };
