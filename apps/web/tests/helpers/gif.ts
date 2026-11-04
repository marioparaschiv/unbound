type GifOptions = {
	width: number;
	height?: number;
	/** Frames, each one colour; two or more make an animated, looping GIF. */
	colors?: [number, number, number][];
};

// 2-bit codes (+1): clear is 4 and end is 5. A clear every two pixels keeps the code table from ever
// growing past 6, so every code stays 3 bits and the image data needs no real LZW encoder.
const MIN_CODE_SIZE = 2;
const CLEAR = 4;
const END = 5;
const CODE_BITS = 3;

function uint16(value: number): number[] {
	return [value & 0xff, value >> 8];
}

function imageData(pixels: number): number[] {
	const codes: number[] = [];

	for (let index = 0; index < pixels; index++) {
		if (index % 2 === 0) {
			codes.push(CLEAR);
		}

		codes.push(0);
	}

	codes.push(END);

	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const code of codes) {
		buffer |= code << bits;
		bits += CODE_BITS;

		while (bits >= 8) {
			bytes.push(buffer & 0xff);
			buffer >>= 8;
			bits -= 8;
		}
	}

	if (bits > 0) {
		bytes.push(buffer & 0xff);
	}

	const blocks: number[] = [MIN_CODE_SIZE];

	for (let offset = 0; offset < bytes.length; offset += 255) {
		const block = bytes.slice(offset, offset + 255);

		blocks.push(block.length, ...block);
	}

	return [...blocks, 0];
}

/**
 * @description Encodes a GIF whose frames are each one solid colour, for tests that need real image bytes.
 * @param options The size and one colour per frame.
 * @returns The GIF's bytes.
 */
export function encodeGif({
	width,
	height = width,
	colors = [[88, 101, 242]],
}: GifOptions): Uint8Array<ArrayBuffer> {
	const animated = colors.length > 1;
	const bytes: number[] = [
		...new TextEncoder().encode('GIF89a'),
		...uint16(width),
		...uint16(height),
		0,
		0,
		0,
	];

	if (animated) {
		// NETSCAPE2.0: loop forever.
		bytes.push(0x21, 0xff, 11, ...new TextEncoder().encode('NETSCAPE2.0'), 3, 1, 0, 0, 0);
	}

	for (const color of colors) {
		// A graphic control extension with a 0.2 s delay, then the frame with its own 2-colour table.
		bytes.push(0x21, 0xf9, 4, 0, ...uint16(20), 0, 0);
		bytes.push(0x2c, 0, 0, 0, 0, ...uint16(width), ...uint16(height), 0x80, ...color, 0, 0, 0);
		bytes.push(...imageData(width * height));
	}

	bytes.push(0x3b);

	return new Uint8Array(bytes);
}

export default { encodeGif };
