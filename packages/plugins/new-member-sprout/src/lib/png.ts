const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_STORED_BLOCK = 0xffff;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;

	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

	return c >>> 0;
});

function crc32(bytes: number[]): number {
	let crc = 0xffffffff;

	for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);

	return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: number[]): number {
	let a = 1;
	let b = 0;

	for (const byte of bytes) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}

	return ((b << 16) | a) >>> 0;
}

function uint32(value: number): number[] {
	return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: number[]): number[] {
	const body = Array.from(type, (char) => char.charCodeAt(0)).concat(data);

	return [...uint32(data.length), ...body, ...uint32(crc32(body))];
}

function storedZlib(raw: number[]): number[] {
	const out = [0x78, 0x01];

	for (let offset = 0; offset < raw.length || offset === 0; offset += MAX_STORED_BLOCK) {
		const block = raw.slice(offset, offset + MAX_STORED_BLOCK);
		const last = offset + MAX_STORED_BLOCK >= raw.length ? 1 : 0;

		out.push(last, block.length & 0xff, block.length >>> 8);
		out.push(~block.length & 0xff, (~block.length >>> 8) & 0xff);
		out.push(...block);

		if (last) break;
	}

	return [...out, ...uint32(adler32(raw))];
}

/**
 * @description Encodes a square, single-color RGBA PNG whose alpha comes from a mask, without compression.
 * @param mask One alpha byte per pixel, row by row.
 * @param size The image's width and height in pixels.
 * @param rgb The color's red, green and blue, 0-255.
 * @returns The PNG file's bytes.
 */
export function maskedPng(
	mask: ArrayLike<number>,
	size: number,
	rgb: [number, number, number],
): number[] {
	const raw: number[] = [];

	for (let y = 0; y < size; y++) {
		raw.push(0);

		for (let x = 0; x < size; x++) raw.push(...rgb, mask[y * size + x] ?? 0);
	}

	const header = [...uint32(size), ...uint32(size), 8, 6, 0, 0, 0];

	return [
		...SIGNATURE,
		...chunk('IHDR', header),
		...chunk('IDAT', storedZlib(raw)),
		...chunk('IEND', []),
	];
}

export default { maskedPng };
