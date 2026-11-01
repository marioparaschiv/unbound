import { deflateSync } from 'node:zlib';

export type PngOptions = {
	width: number;
	height?: number;
	/** RGBA of each pixel; a disc in `color` on a transparent ground by default. */
	pixel?: (x: number, y: number) => [number, number, number, number];
	color?: [number, number, number];
	/** Adds an `acTL` chunk before the image data, as an animated PNG has. */
	animated?: boolean;
	/** Bytes of `tEXt` chunk to add after the image data, for a valid PNG of a given file size. */
	padding?: number;
};

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunk(type: string, data: Uint8Array): Uint8Array {
	const body = new Uint8Array(4 + data.byteLength);

	body.set(new TextEncoder().encode(type));
	body.set(data, 4);

	const out = new Uint8Array(12 + data.byteLength);
	const view = new DataView(out.buffer);

	view.setUint32(0, data.byteLength);
	out.set(body, 4);
	view.setUint32(8 + data.byteLength, Bun.hash.crc32(body));

	return out;
}

function uint32s(...values: number[]): Uint8Array {
	const out = new Uint8Array(values.length * 4);
	const view = new DataView(out.buffer);

	for (const [index, value] of values.entries()) {
		view.setUint32(index * 4, value);
	}

	return out;
}

function disc(width: number, height: number, [r, g, b]: [number, number, number]) {
	const radius = Math.min(width, height) / 2;

	return (x: number, y: number): [number, number, number, number] => {
		const distance = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2);
		// Lighter towards the top left, so the face reads as lit.
		const shade = 1.25 - (x + y) / (width + height) / 2;
		const alpha = Math.max(0, Math.min(1, radius - distance)) * 255;

		return [
			Math.min(255, r * shade),
			Math.min(255, g * shade),
			Math.min(255, b * shade),
			alpha,
		];
	};
}

/**
 * @description Encodes an 8-bit RGBA PNG, for tests that need real image bytes without fixtures.
 * @param options The size, pixels and whether to mark it animated.
 * @returns The PNG's bytes.
 */
export function encodePng({
	width,
	height = width,
	color = [88, 101, 242],
	pixel = disc(width, height, color),
	animated = false,
	padding = 0,
}: PngOptions): Uint8Array<ArrayBuffer> {
	const rows = new Uint8Array(height * (1 + width * 4));

	for (let y = 0; y < height; y++) {
		const start = y * (1 + width * 4);

		for (let x = 0; x < width; x++) {
			rows.set(pixel(x, y), start + 1 + x * 4);
		}
	}

	const header = new Uint8Array(13);

	header.set(uint32s(width, height));
	header.set([8, 6, 0, 0, 0], 8);

	const parts = [
		new Uint8Array(SIGNATURE),
		chunk('IHDR', header),
		...(animated ? [chunk('acTL', uint32s(1, 0))] : []),
		chunk('IDAT', deflateSync(rows)),
		...(padding > 0 ? [chunk('tEXt', new Uint8Array(padding).fill(0x61))] : []),
		chunk('IEND', new Uint8Array()),
	];

	return new Uint8Array(Buffer.concat(parts));
}

export default { encodePng };
