const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @description Reads a PNG's pixel size from its header.
 * @param bytes The PNG file.
 * @returns The width and height in pixels, or `undefined` for anything that is not a PNG.
 */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
	if (bytes.length < 24 || SIGNATURE.some((byte, index) => bytes[index] !== byte))
		return undefined;

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const width = view.getUint32(16);
	const height = view.getUint32(20);

	return width && height ? { width, height } : undefined;
}

export default pngSize;
