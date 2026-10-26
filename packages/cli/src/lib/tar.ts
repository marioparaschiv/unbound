import { gzipSync } from 'node:zlib';

export type TarEntry = { name: string; data: Uint8Array };

const BLOCK_SIZE = 512;
const FILE_MODE = 0o644;

/**
 * @description Packs files into a gzipped ustar archive, owned by no one and readable by everyone,
 * so it extracts the same with any tar.
 * @param entries The files to pack, by their path inside the archive.
 * @param mtime When the files were last modified, in milliseconds since the epoch.
 * @returns The `.tar.gz` bytes.
 */
export function createTarGz(entries: TarEntry[], mtime: number = Date.now()): Buffer {
	const blocks: Uint8Array[] = [];

	for (const entry of entries) {
		blocks.push(createHeader(entry, Math.floor(mtime / 1000)));
		blocks.push(entry.data);
		blocks.push(new Uint8Array(padding(entry.data.length)));
	}

	blocks.push(new Uint8Array(BLOCK_SIZE * 2));

	return gzipSync(Buffer.concat(blocks));
}

function createHeader(entry: TarEntry, mtime: number): Uint8Array {
	const name = Buffer.from(entry.name, 'utf8');

	if (name.length > 100) {
		throw new Error(`${entry.name} is too long for a tar entry name.`);
	}

	const header = Buffer.alloc(BLOCK_SIZE);

	name.copy(header, 0);
	writeOctal(header, 100, 8, FILE_MODE);
	writeOctal(header, 108, 8, 0);
	writeOctal(header, 116, 8, 0);
	writeOctal(header, 124, 12, entry.data.length);
	writeOctal(header, 136, 12, mtime);
	header.fill(' ', 148, 156);
	header.write('0', 156, 'ascii');
	header.write('ustar\u000000', 257, 'ascii');

	const checksum = header.reduce((sum, byte) => sum + byte, 0);

	header.write(`${checksum.toString(8).padStart(6, '0')}\u0000 `, 148, 'ascii');

	return header;
}

function writeOctal(header: Buffer, offset: number, length: number, value: number) {
	header.write(`${value.toString(8).padStart(length - 1, '0')}\u0000`, offset, 'ascii');
}

function padding(size: number): number {
	return (BLOCK_SIZE - (size % BLOCK_SIZE)) % BLOCK_SIZE;
}

export default createTarGz;
