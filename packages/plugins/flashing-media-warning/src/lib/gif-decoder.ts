export type DecodedFrame = { rgba: Uint8Array; delayMs: number };

export type DecodedGif = { width: number; height: number; frames: DecodedFrame[] };

export type DecodeOptions = { maxFrames?: number; maxWidth?: number };

const MIN_DELAY_MS = 20;
const DEFAULT_DELAY_MS = 100;

class Reader {
	offset = 0;

	constructor(readonly bytes: Uint8Array) {}

	byte(): number {
		if (this.offset >= this.bytes.length) throw new Error('the GIF ends early');

		return this.bytes[this.offset++]!;
	}

	short(): number {
		return this.byte() | (this.byte() << 8);
	}

	take(length: number): Uint8Array {
		const out = this.bytes.subarray(this.offset, this.offset + length);

		this.offset += length;

		return out;
	}

	subBlocks(): Uint8Array {
		const parts: Uint8Array[] = [];
		let size = this.byte();

		while (size) {
			parts.push(this.take(size));
			size = this.byte();
		}

		const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
		let at = 0;

		for (const part of parts) {
			out.set(part, at);
			at += part.length;
		}

		return out;
	}
}

function lzw(data: Uint8Array, minCodeSize: number, pixels: number): Uint8Array {
	const out = new Uint8Array(pixels);
	const clear = 1 << minCodeSize;
	const end = clear + 1;
	const prefix = new Int32Array(4096);
	const suffix = new Uint8Array(4096);
	const firstOf = new Uint8Array(4096);
	const stack = new Uint8Array(4097);
	let codeSize = minCodeSize + 1;
	let next = end + 1;
	let previous = -1;
	let bits = 0;
	let buffer = 0;
	let written = 0;

	for (let index = 0; index < clear; index++) {
		suffix[index] = index;
		firstOf[index] = index;
		prefix[index] = -1;
	}

	for (const byte of data) {
		buffer |= byte << bits;
		bits += 8;

		while (bits >= codeSize) {
			const code = buffer & ((1 << codeSize) - 1);

			buffer >>= codeSize;
			bits -= codeSize;

			if (code === clear) {
				codeSize = minCodeSize + 1;
				next = end + 1;
				previous = -1;
				continue;
			}

			if (code === end) return out;

			let current = code;
			let depth = 0;

			if (code >= next && previous >= 0) {
				stack[depth++] = firstOf[previous]!;
				current = previous;
			}

			while (current >= clear) {
				stack[depth++] = suffix[current]!;
				current = prefix[current]!;
			}

			stack[depth++] = current;

			const first = current;

			while (depth && written < pixels) out[written++] = stack[--depth]!;

			if (previous >= 0 && next < 4096) {
				prefix[next] = previous;
				suffix[next] = first;
				firstOf[next] = firstOf[previous]!;
				next++;

				if (next === 1 << codeSize && codeSize < 12) codeSize++;
			}

			previous = code;
		}
	}

	return out;
}

function deinterlace(indices: Uint8Array, width: number, height: number): Uint8Array {
	const out = new Uint8Array(indices.length);
	let row = 0;

	for (const [start, step] of [
		[0, 8],
		[4, 8],
		[2, 4],
		[1, 2],
	] as const) {
		for (let y = start; y < height; y += step) {
			out.set(indices.subarray(row * width, (row + 1) * width), y * width);
			row++;
		}
	}

	return out;
}

function sampler(width: number, height: number, maxWidth: number) {
	const scale = Math.min(1, maxWidth / width);
	const outWidth = Math.max(1, Math.round(width * scale));
	const outHeight = Math.max(1, Math.round(height * scale));

	return {
		width: outWidth,
		height: outHeight,
		sample(canvas: Uint8Array): Uint8Array {
			if (scale === 1) return canvas.slice();

			const out = new Uint8Array(outWidth * outHeight * 4);

			for (let y = 0; y < outHeight; y++) {
				const sy = Math.min(height - 1, Math.floor(y / scale));

				for (let x = 0; x < outWidth; x++) {
					const from = (sy * width + Math.min(width - 1, Math.floor(x / scale))) * 4;

					out.set(canvas.subarray(from, from + 4), (y * outWidth + x) * 4);
				}
			}

			return out;
		},
	};
}

function readTable(reader: Reader, packed: number): Uint8Array {
	return reader.take(3 * (1 << ((packed & 7) + 1)));
}

/**
 * @description Decodes every frame of a GIF into full RGBA canvases, applying each frame's position, transparency
 * and disposal, as browsers draw them.
 * @param bytes The GIF file.
 * @param options Stop after `maxFrames`, and scale frames down to `maxWidth`.
 * @returns The frames' size and the frames with their delays.
 */
export function decodeGif(
	bytes: Uint8Array,
	{ maxFrames = 600, maxWidth = Number.POSITIVE_INFINITY }: DecodeOptions = {},
): DecodedGif {
	const reader = new Reader(bytes);
	const signature = String.fromCharCode(...reader.take(6));

	if (!signature.startsWith('GIF8')) throw new Error('not a GIF');

	const width = reader.short();
	const height = reader.short();
	const packed = reader.byte();

	reader.take(2);

	const globalTable = packed & 0x80 ? readTable(reader, packed) : undefined;
	const canvas = new Uint8Array(width * height * 4);
	const output = sampler(width, height, maxWidth);
	const frames: DecodedFrame[] = [];
	let delayMs = DEFAULT_DELAY_MS;
	let transparent = -1;
	let disposal = 0;

	while (frames.length < maxFrames) {
		const block = reader.byte();

		if (block === 0x3b) break;

		if (block === 0x21) {
			const label = reader.byte();
			const data = reader.subBlocks();

			if (label === 0xf9 && data.length >= 4) {
				disposal = (data[0]! >> 2) & 7;
				delayMs = Math.max(
					MIN_DELAY_MS,
					(data[1]! | (data[2]! << 8)) * 10 || DEFAULT_DELAY_MS,
				);
				transparent = data[0]! & 1 ? data[3]! : -1;
			}

			continue;
		}

		if (block !== 0x2c) throw new Error(`unknown GIF block ${block}`);

		const left = reader.short();
		const top = reader.short();
		const frameWidth = reader.short();
		const frameHeight = reader.short();
		const framePacked = reader.byte();
		const table = framePacked & 0x80 ? readTable(reader, framePacked) : globalTable;
		const minCodeSize = reader.byte();
		const raw = lzw(reader.subBlocks(), minCodeSize, frameWidth * frameHeight);
		const indices = framePacked & 0x40 ? deinterlace(raw, frameWidth, frameHeight) : raw;
		const before = disposal === 3 ? canvas.slice() : undefined;

		if (!table) throw new Error('a GIF frame has no colour table');

		for (let y = 0; y < frameHeight; y++) {
			for (let x = 0; x < frameWidth; x++) {
				const index = indices[y * frameWidth + x]!;
				const cx = left + x;
				const cy = top + y;

				if (index === transparent || cx >= width || cy >= height) continue;

				const at = (cy * width + cx) * 4;

				canvas[at] = table[index * 3]!;
				canvas[at + 1] = table[index * 3 + 1]!;
				canvas[at + 2] = table[index * 3 + 2]!;
				canvas[at + 3] = 255;
			}
		}

		frames.push({ rgba: output.sample(canvas), delayMs });

		if (disposal === 2) {
			for (let y = top; y < Math.min(height, top + frameHeight); y++) {
				canvas.fill(
					0,
					(y * width + left) * 4,
					(y * width + Math.min(width, left + frameWidth)) * 4,
				);
			}
		} else if (before) {
			canvas.set(before);
		}

		delayMs = DEFAULT_DELAY_MS;
		transparent = -1;
		disposal = 0;
	}

	return { width: output.width, height: output.height, frames };
}
