import { crc32, deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);

	length.writeUInt32BE(data.length);
	crc.writeUInt32BE(crc32(body) >>> 0);

	return Buffer.concat([length, body, crc]);
}

/**
 * @description Encodes one 8-bit channel as a greyscale PNG, a quarter of the RGBA bytes.
 * @param channel The channel's values, row by row.
 * @param width The image width in pixels.
 * @param height The image height in pixels.
 * @returns The PNG file.
 */
function encodeGrayPng(channel: Uint8Array, width: number, height: number): Buffer {
	const header = Buffer.alloc(13);
	// Each scanline starts with its filter type; 0 leaves the row as is.
	const scanlines = Buffer.alloc((width + 1) * height);

	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 0;

	for (let y = 0; y < height; y++) {
		scanlines.set(channel.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
	}

	return Buffer.concat([
		SIGNATURE,
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(scanlines, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

export default encodeGrayPng;
