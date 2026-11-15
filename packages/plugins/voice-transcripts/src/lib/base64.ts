const CHUNK = 0x8000;

/**
 * @description Encodes bytes as base64, in chunks so long images do not overflow the call stack.
 * @param buffer The bytes.
 * @returns The base64 text.
 */
export function toBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';

	for (let offset = 0; offset < bytes.length; offset += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
	}

	return btoa(binary);
}

export default toBase64;
