const WOFF_SIGNATURE = 0x774f4646;
const WOFF2_SIGNATURE = 0x774f4632;
const WOFF_HEADER = 44;
const WOFF_ENTRY = 20;
const SFNT_HEADER = 12;
const SFNT_ENTRY = 16;

export type Inflate = (compressed: Uint8Array, length: number) => Uint8Array;

export type FontFormat = 'sfnt' | 'woff' | 'woff2' | 'unknown';

type Table = { tag: number; checksum: number; data: Uint8Array };

/**
 * @description Tells a font file's format from its first bytes.
 * @param bytes The file.
 * @returns `sfnt` for TrueType and OpenType, `woff`, `woff2`, or `unknown`.
 */
export function fontFormat(bytes: Uint8Array): FontFormat {
	if (bytes.byteLength < 4) return 'unknown';

	const signature = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);

	if (signature === WOFF_SIGNATURE) return 'woff';
	if (signature === WOFF2_SIGNATURE) return 'woff2';
	if (signature === 0x00010000 || signature === 0x4f54544f || signature === 0x74727565)
		return 'sfnt';

	return 'unknown';
}

function readTables(bytes: Uint8Array, inflate: Inflate): { flavor: number; tables: Table[] } {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const flavor = view.getUint32(4);
	const count = view.getUint16(12);
	const tables: Table[] = [];

	for (let index = 0; index < count; index++) {
		const entry = WOFF_HEADER + index * WOFF_ENTRY;
		const offset = view.getUint32(entry + 4);
		const compressed = view.getUint32(entry + 8);
		const original = view.getUint32(entry + 12);
		const raw = bytes.subarray(offset, offset + compressed);

		tables.push({
			tag: view.getUint32(entry),
			checksum: view.getUint32(entry + 16),
			data: compressed < original ? inflate(raw, original) : raw,
		});
	}

	return { flavor, tables };
}

function padded(length: number): number {
	return (length + 3) & ~3;
}

/**
 * @description Unpacks a WOFF 1 font into the TrueType or OpenType file it wraps, so the system can load it.
 * @param bytes The WOFF file.
 * @param inflate Decompresses one zlib table to its original length.
 * @returns The sfnt file.
 */
export function woffToSfnt(bytes: Uint8Array, inflate: Inflate): Uint8Array {
	const { flavor, tables } = readTables(bytes, inflate);
	const directory = SFNT_HEADER + tables.length * SFNT_ENTRY;
	const size = tables.reduce((total, table) => total + padded(table.data.byteLength), directory);
	const out = new Uint8Array(size);
	const view = new DataView(out.buffer);
	const power = 2 ** Math.floor(Math.log2(tables.length || 1));

	view.setUint32(0, flavor);
	view.setUint16(4, tables.length);
	view.setUint16(6, power * 16);
	view.setUint16(8, Math.log2(power));
	view.setUint16(10, tables.length * 16 - power * 16);

	let offset = directory;

	tables.forEach((table, index) => {
		const entry = SFNT_HEADER + index * SFNT_ENTRY;

		view.setUint32(entry, table.tag);
		view.setUint32(entry + 4, table.checksum);
		view.setUint32(entry + 8, offset);
		view.setUint32(entry + 12, table.data.byteLength);
		out.set(table.data, offset);
		offset += padded(table.data.byteLength);
	});

	return out;
}
