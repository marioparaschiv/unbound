/** One file inside a zip archive. */
export type ZipEntry = { name: string; size: number };

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const END_RECORD_SIZE = 22;
const MAX_COMMENT = 0xffff;
const ENTRY_HEADER_SIZE = 46;

function findEndRecord(view: DataView): number | undefined {
	const last = view.byteLength - END_RECORD_SIZE;

	for (let offset = last; offset >= Math.max(0, last - MAX_COMMENT); offset--) {
		if (view.getUint32(offset, true) === END_OF_DIRECTORY) return offset;
	}

	return undefined;
}

function continuation(bytes: Uint8Array, index: number): number {
	return (bytes[index] ?? 0) & 0x3f;
}

function decodeName(bytes: Uint8Array): string {
	const codes: number[] = [];

	for (let index = 0; index < bytes.length;) {
		const byte = bytes[index] ?? 0;

		if (byte < 0x80) {
			codes.push(byte);
			index += 1;
		} else if (byte >= 0xf0) {
			codes.push(
				((byte & 0x07) << 18) |
					(continuation(bytes, index + 1) << 12) |
					(continuation(bytes, index + 2) << 6) |
					continuation(bytes, index + 3),
			);
			index += 4;
		} else if (byte >= 0xe0) {
			codes.push(
				((byte & 0x0f) << 12) |
					(continuation(bytes, index + 1) << 6) |
					continuation(bytes, index + 2),
			);
			index += 3;
		} else {
			codes.push(((byte & 0x1f) << 6) | continuation(bytes, index + 1));
			index += 2;
		}
	}

	return String.fromCodePoint(...codes);
}

/**
 * @description Lists the files in a zip archive from its central directory, skipping folders.
 * @param bytes The whole archive.
 * @returns The files in the archive's order, or `undefined` when the bytes are not a zip archive this reads (ZIP64 included).
 */
export function listZip(bytes: Uint8Array): ZipEntry[] | undefined {
	if (bytes.byteLength < END_RECORD_SIZE) return undefined;

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const end = findEndRecord(view);

	if (end === undefined) return undefined;

	const count = view.getUint16(end + 10, true);
	let offset = view.getUint32(end + 16, true);
	const entries: ZipEntry[] = [];

	for (let index = 0; index < count; index++) {
		if (
			offset + ENTRY_HEADER_SIZE > bytes.byteLength ||
			view.getUint32(offset, true) !== DIRECTORY_ENTRY
		)
			return undefined;

		const size = view.getUint32(offset + 24, true);
		const nameLength = view.getUint16(offset + 28, true);
		const extraLength = view.getUint16(offset + 30, true);
		const commentLength = view.getUint16(offset + 32, true);
		const name = decodeName(
			bytes.subarray(offset + ENTRY_HEADER_SIZE, offset + ENTRY_HEADER_SIZE + nameLength),
		);

		if (!name.endsWith('/')) entries.push({ name, size });

		offset += ENTRY_HEADER_SIZE + nameLength + extraLength + commentLength;
	}

	return entries;
}

/**
 * @description Formats a byte count for the file list.
 * @param bytes The size.
 * @returns The size, such as `12.3 KB`.
 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default listZip;
