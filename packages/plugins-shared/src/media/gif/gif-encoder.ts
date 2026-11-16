import type { Palette } from './palette';

export type GifOptions = {
	width: number;
	height: number;
	delayCentiseconds: number;
	palette: Palette;
	transparent?: boolean;
};

const TRANSPARENT_INDEX = 255;
const OPAQUE = 128;
const RESTORE_BACKGROUND_WITH_TRANSPARENCY = 0x09;

class ByteWriter {
	private chunks: number[] = [];

	byte(value: number) {
		this.chunks.push(value & 0xff);
	}

	short(value: number) {
		this.byte(value);
		this.byte(value >> 8);
	}

	bytes(values: ArrayLike<number>) {
		for (let index = 0; index < values.length; index++) this.byte(values[index]!);
	}

	ascii(text: string) {
		for (const char of text) this.byte(char.charCodeAt(0));
	}

	result(): Uint8Array {
		return Uint8Array.from(this.chunks);
	}
}

function lzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
	const clear = 1 << minCodeSize;
	const end = clear + 1;
	const output: number[] = [];
	let codeSize = minCodeSize + 1;
	let next = end + 1;
	let buffer = 0;
	let bits = 0;
	let table = new Map<string, number>();

	function emit(code: number) {
		buffer |= code << bits;
		bits += codeSize;

		while (bits >= 8) {
			output.push(buffer & 0xff);
			buffer >>= 8;
			bits -= 8;
		}
	}

	emit(clear);

	let prefix = String(indices[0] ?? 0);

	for (let position = 1; position < indices.length; position++) {
		const value = indices[position]!;
		const key = `${prefix},${value}`;

		if (table.has(key)) {
			prefix = key;
			continue;
		}

		emit(prefix.includes(',') ? table.get(prefix)! : Number(prefix));

		if (next < 4096) {
			table.set(key, next++);

			if (next > 1 << codeSize && codeSize < 12) codeSize++;
		} else {
			emit(clear);
			table = new Map();
			codeSize = minCodeSize + 1;
			next = end + 1;
		}

		prefix = String(value);
	}

	emit(prefix.includes(',') ? table.get(prefix)! : Number(prefix));
	emit(end);

	if (bits > 0) output.push(buffer & 0xff);

	return Uint8Array.from(output);
}

function subBlocks(writer: ByteWriter, data: Uint8Array) {
	for (let offset = 0; offset < data.length; offset += 255) {
		const block = data.subarray(offset, offset + 255);

		writer.byte(block.length);
		writer.bytes(block);
	}

	writer.byte(0);
}

function indexFrame(frame: Uint8Array, palette: Palette, transparent: boolean): Uint8Array {
	const indices = new Uint8Array(frame.length / 4);

	for (let pixel = 0; pixel < indices.length; pixel++) {
		const offset = pixel * 4;

		indices[pixel] =
			transparent && frame[offset + 3]! < OPAQUE
				? TRANSPARENT_INDEX
				: palette.lookup(frame[offset]!, frame[offset + 1]!, frame[offset + 2]!);
	}

	return indices;
}

/**
 * @description Encodes RGBA frames of the same size as a looping GIF89a with one shared palette. With `transparent`,
 * mostly transparent pixels stay see-through: build the palette with at most 255 colours, since index 255 is reserved.
 * @param frames The frames' RGBA bytes, in order.
 * @param options The size, the delay between frames, the palette from `buildPalette`, and whether to keep transparency.
 * @returns The GIF file's bytes.
 */
export function encodeGif(
	frames: Uint8Array[],
	{ width, height, delayCentiseconds, palette, transparent = false }: GifOptions,
): Uint8Array {
	const writer = new ByteWriter();

	writer.ascii('GIF89a');
	writer.short(width);
	writer.short(height);
	writer.byte(0xf7);
	writer.byte(0);
	writer.byte(0);
	writer.bytes(palette.colors);
	writer.bytes([0x21, 0xff, 0x0b]);
	writer.ascii('NETSCAPE2.0');
	writer.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

	for (const frame of frames) {
		writer.bytes([0x21, 0xf9, 0x04, transparent ? RESTORE_BACKGROUND_WITH_TRANSPARENCY : 0x00]);
		writer.short(delayCentiseconds);
		writer.bytes([transparent ? TRANSPARENT_INDEX : 0x00, 0x00]);
		writer.byte(0x2c);
		writer.short(0);
		writer.short(0);
		writer.short(width);
		writer.short(height);
		writer.byte(0);
		writer.byte(8);
		subBlocks(writer, lzw(indexFrame(frame, palette, transparent), 8));
	}

	writer.byte(0x3b);

	return writer.result();
}

export default { encodeGif };
