const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const STORED_BLOCK = 0xffff;
const RGBA = 6;

let crcTable: Uint32Array | undefined;

function table(): Uint32Array {
	if (crcTable) return crcTable;

	crcTable = new Uint32Array(256);

	for (let n = 0; n < 256; n++) {
		let c = n;

		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

		crcTable[n] = c >>> 0;
	}

	return crcTable;
}

/**
 * @description Computes the CRC-32 PNG chunks carry.
 * @param bytes The bytes.
 * @returns The checksum.
 */
export function crc32(bytes: Uint8Array): number {
	const lookup = table();
	let c = 0xffffffff;

	for (const byte of bytes) c = lookup[(c ^ byte) & 0xff]! ^ (c >>> 8);

	return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
	let a = 1;
	let b = 0;

	for (const byte of bytes) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}

	return ((b << 16) | a) >>> 0;
}

function storedZlib(raw: Uint8Array): Uint8Array {
	const blocks = Math.max(1, Math.ceil(raw.byteLength / STORED_BLOCK));
	const out = new Uint8Array(2 + raw.byteLength + blocks * 5 + 4);
	const view = new DataView(out.buffer);
	let offset = 2;

	out[0] = 0x78;
	out[1] = 0x01;

	for (let block = 0; block < blocks; block++) {
		const start = block * STORED_BLOCK;
		const length = Math.min(STORED_BLOCK, raw.byteLength - start);

		out[offset] = block === blocks - 1 ? 1 : 0;
		view.setUint16(offset + 1, length, true);
		view.setUint16(offset + 3, ~length & 0xffff, true);
		out.set(raw.subarray(start, start + length), offset + 5);
		offset += 5 + length;
	}

	view.setUint32(offset, adler32(raw));

	return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.byteLength);
	const view = new DataView(out.buffer);
	const typed = out.subarray(4, 8 + data.byteLength);

	view.setUint32(0, data.byteLength);

	for (let index = 0; index < 4; index++) out[4 + index] = type.charCodeAt(index);

	out.set(data, 8);
	view.setUint32(8 + data.byteLength, crc32(typed));

	return out;
}

/**
 * @description Encodes RGBA pixels as a PNG with uncompressed deflate blocks, which every decoder reads; small emoji
 * tiles stay well under Discord's size limit without a compressor.
 * @param rgba The pixels, row by row.
 * @param width The width.
 * @param height The height.
 * @returns The PNG file.
 */
export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
	const header = new Uint8Array(13);
	const headerView = new DataView(header.buffer);
	const raw = new Uint8Array(height * (width * 4 + 1));

	headerView.setUint32(0, width);
	headerView.setUint32(4, height);
	header[8] = 8;
	header[9] = RGBA;

	for (let row = 0; row < height; row++) {
		raw.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), row * (width * 4 + 1) + 1);
	}

	const parts = [
		new Uint8Array(SIGNATURE),
		chunk('IHDR', header),
		chunk('IDAT', storedZlib(raw)),
		chunk('IEND', new Uint8Array()),
	];
	const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
	let offset = 0;

	for (const part of parts) {
		out.set(part, offset);
		offset += part.byteLength;
	}

	return out;
}
