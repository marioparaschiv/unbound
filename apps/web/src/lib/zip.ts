/** One file of a zip archive. */
export type ZipEntry = {
	/** The `/`-separated path inside the archive. */
	path: string;
	data: Uint8Array;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;

	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

	return c >>> 0;
});

// 1980-01-01 00:00, the earliest DOS date, so the same files always make the same archive.
const DOS_DATE = 0x21;
const UTF8_FLAG = 0x0800;

function crc32(data: Uint8Array) {
	let crc = 0xffffffff;

	for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);

	return (crc ^ 0xffffffff) >>> 0;
}

function header(size: number, write: (view: DataView) => void) {
	const bytes = new Uint8Array(size);

	write(new DataView(bytes.buffer));

	return bytes;
}

/**
 * @description Packs files into an uncompressed (stored) zip archive.
 * @param entries The files, in archive order.
 * @returns The archive's bytes.
 */
export function createZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const { path, data } of entries) {
		const name = encoder.encode(path);
		const crc = crc32(data);

		// The fields both the local header and the central directory record carry, from "version needed" on.
		function common(view: DataView, at: number) {
			view.setUint16(at, 20, true);
			view.setUint16(at + 2, UTF8_FLAG, true);
			view.setUint16(at + 4, 0, true);
			view.setUint16(at + 6, 0, true);
			view.setUint16(at + 8, DOS_DATE, true);
			view.setUint32(at + 10, crc, true);
			view.setUint32(at + 14, data.length, true);
			view.setUint32(at + 18, data.length, true);
			view.setUint16(at + 22, name.length, true);
		}

		const local = header(30, (view) => {
			view.setUint32(0, 0x04034b50, true);
			common(view, 4);
		});

		central.push(
			header(46, (view) => {
				view.setUint32(0, 0x02014b50, true);
				view.setUint16(4, 20, true);
				common(view, 6);
				view.setUint32(42, offset, true);
			}),
			name,
		);
		parts.push(local, name, data);
		offset += local.length + name.length + data.length;
	}

	const centralSize = central.reduce((sum, part) => sum + part.length, 0);
	const end = header(22, (view) => {
		view.setUint32(0, 0x06054b50, true);
		view.setUint16(8, entries.length, true);
		view.setUint16(10, entries.length, true);
		view.setUint32(12, centralSize, true);
		view.setUint32(16, offset, true);
	});
	const all = [...parts, ...central, end];
	const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
	let at = 0;

	for (const part of all) {
		out.set(part, at);
		at += part.length;
	}

	return out;
}

export default { createZip };
