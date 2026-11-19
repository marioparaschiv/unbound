import { latin1, utf16, utf8 } from '~/lib/text';

export type Cover = { mime: string; bytes: Uint8Array };

export type SongTags = { title?: string; artist?: string; album?: string; cover?: Cover };

const ID3_TEXT: Record<string, keyof Omit<SongTags, 'cover'>> = {
	TIT2: 'title',
	TPE1: 'artist',
	TALB: 'album',
};

const VORBIS_TEXT: Record<string, keyof Omit<SongTags, 'cover'>> = {
	TITLE: 'title',
	ARTIST: 'artist',
	ALBUM: 'album',
};

const MP4_TEXT: Record<string, keyof Omit<SongTags, 'cover'>> = {
	'©nam': 'title',
	'©ART': 'artist',
	'©alb': 'album',
};

function bigEndian(bytes: Uint8Array, offset: number, length = 4): number {
	let value = 0;

	for (let index = 0; index < length; index++) value = value * 256 + (bytes[offset + index] ?? 0);

	return value;
}

function littleEndian(bytes: Uint8Array, offset: number): number {
	return (
		(bytes[offset] ?? 0) +
		(bytes[offset + 1] ?? 0) * 0x100 +
		(bytes[offset + 2] ?? 0) * 0x10000 +
		(bytes[offset + 3] ?? 0) * 0x1000000
	);
}

function syncsafe(bytes: Uint8Array, offset: number): number {
	return [0, 1, 2, 3].reduce(
		(value, index) => value * 128 + ((bytes[offset + index] ?? 0) & 0x7f),
		0,
	);
}

function id3Text(encoding: number, bytes: Uint8Array): string {
	const text =
		encoding === 1 || encoding === 2
			? utf16(bytes, encoding === 2)
			: encoding === 3
				? utf8(bytes)
				: latin1(bytes);

	return text.replace(/\0+$/, '').split('\0')[0] ?? '';
}

function terminator(bytes: Uint8Array, start: number, wide: boolean): number {
	for (let index = start; index < bytes.length; index += wide ? 2 : 1) {
		if (bytes[index] === 0 && (!wide || bytes[index + 1] === 0)) return index;
	}

	return bytes.length;
}

function id3Picture(frame: Uint8Array): Cover | undefined {
	const encoding = frame[0] ?? 0;
	const mimeEnd = terminator(frame, 1, false);
	const mime = latin1(frame.subarray(1, mimeEnd)) || 'image/jpeg';
	const wide = encoding === 1 || encoding === 2;
	const descriptionEnd = terminator(frame, mimeEnd + 2, wide);
	const data = frame.subarray(descriptionEnd + (wide ? 2 : 1));

	return data.length
		? { mime: mime.includes('/') ? mime : `image/${mime.toLowerCase()}`, bytes: data }
		: undefined;
}

function readID3(bytes: Uint8Array): SongTags {
	const version = bytes[3] ?? 0;
	const end = Math.min(bytes.length, 10 + syncsafe(bytes, 6));
	const tags: SongTags = {};
	let offset = 10;

	while (offset + 10 <= end) {
		const id = latin1(bytes.subarray(offset, offset + 4));
		const size = version >= 4 ? syncsafe(bytes, offset + 4) : bigEndian(bytes, offset + 4);
		const frame = bytes.subarray(offset + 10, offset + 10 + size);

		if (!/^[A-Z0-9]{4}$/.test(id) || size <= 0) break;

		const field = ID3_TEXT[id];

		if (field) tags[field] = id3Text(frame[0] ?? 0, frame.subarray(1));
		else if (id === 'APIC' && !tags.cover) tags.cover = id3Picture(frame);

		offset += 10 + size;
	}

	return tags;
}

function readFlac(bytes: Uint8Array): SongTags {
	const tags: SongTags = {};
	let offset = 4;
	let last = false;

	while (!last && offset + 4 <= bytes.length) {
		const header = bytes[offset] ?? 0;
		const length = bigEndian(bytes, offset + 1, 3);
		const block = bytes.subarray(offset + 4, offset + 4 + length);

		last = (header & 0x80) !== 0;

		if ((header & 0x7f) === 4) {
			let cursor = 4 + littleEndian(block, 0);
			const count = littleEndian(block, cursor);

			cursor += 4;

			for (let index = 0; index < count && cursor + 4 <= block.length; index++) {
				const size = littleEndian(block, cursor);
				const [key = '', ...value] = utf8(
					block.subarray(cursor + 4, cursor + 4 + size),
				).split('=');
				const field = VORBIS_TEXT[key.toUpperCase()];

				if (field && !tags[field]) tags[field] = value.join('=');

				cursor += 4 + size;
			}
		} else if ((header & 0x7f) === 6 && !tags.cover) {
			const mimeLength = bigEndian(block, 4);
			const mime = latin1(block.subarray(8, 8 + mimeLength));
			const descriptionLength = bigEndian(block, 8 + mimeLength);
			const dataStart = 8 + mimeLength + 4 + descriptionLength + 16;
			const dataLength = bigEndian(block, dataStart);

			tags.cover = { mime, bytes: block.subarray(dataStart + 4, dataStart + 4 + dataLength) };
		}

		offset += 4 + length;
	}

	return tags;
}

function atoms(
	bytes: Uint8Array,
	start: number,
	end: number,
): { type: string; start: number; end: number }[] {
	const found: { type: string; start: number; end: number }[] = [];
	let offset = start;

	while (offset + 8 <= end) {
		const size = bigEndian(bytes, offset);

		if (size < 8) break;

		found.push({
			type: latin1(bytes.subarray(offset + 4, offset + 8)),
			start: offset + 8,
			end: Math.min(end, offset + size),
		});
		offset += size;
	}

	return found;
}

function child(
	bytes: Uint8Array,
	parent: { start: number; end: number } | undefined,
	type: string,
	skip = 0,
) {
	return (
		parent && atoms(bytes, parent.start + skip, parent.end).find((atom) => atom.type === type)
	);
}

function readMp4(bytes: Uint8Array): SongTags {
	const moov = atoms(bytes, 0, bytes.length).find((atom) => atom.type === 'moov');
	const meta = child(bytes, child(bytes, moov, 'udta'), 'meta');
	const ilst = child(bytes, meta, 'ilst', 4);
	const tags: SongTags = {};

	for (const item of ilst ? atoms(bytes, ilst.start, ilst.end) : []) {
		const data = child(bytes, item, 'data');

		if (!data) continue;

		const payload = bytes.subarray(data.start + 8, data.end);
		const field = MP4_TEXT[item.type];

		if (field) tags[field] = utf8(payload);
		else if (item.type === 'covr') {
			tags.cover = {
				mime: bigEndian(bytes, data.start) === 14 ? 'image/png' : 'image/jpeg',
				bytes: payload,
			};
		}
	}

	return tags;
}

/**
 * @description Reads the title, artist, album and cover from the start of an audio file: an ID3v2 tag (MP3), FLAC
 * metadata blocks, or an MP4 `ilst` (M4A) when its `moov` atom comes first.
 * @param bytes The file's first bytes.
 * @returns The tags it found, empty when it found none.
 */
export function readTags(bytes: Uint8Array): SongTags {
	const magic = latin1(bytes.subarray(0, 4));

	if (magic.startsWith('ID3')) return readID3(bytes);

	if (magic === 'fLaC') return readFlac(bytes);

	if (latin1(bytes.subarray(4, 8)) === 'ftyp') return readMp4(bytes);

	return {};
}
