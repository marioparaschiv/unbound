import { describe, expect, test } from 'bun:test';

import { readTags } from '~/lib/tags';
import { base64, utf16, utf8 } from '~/lib/text';

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const be32 = (value: number) => [
	value >>> 24,
	(value >>> 16) & 255,
	(value >>> 8) & 255,
	value & 255,
];
const le32 = (value: number) => be32(value).reverse();

function id3Frame(id: string, body: number[]) {
	return [...ascii(id), ...be32(body.length), 0, 0, ...body];
}

describe('readTags', () => {
	test('reads an ID3v2.3 tag with a cover', () => {
		const frames = [
			...id3Frame('TIT2', [3, ...ascii('Song')]),
			...id3Frame('TPE1', [
				1,
				0xff,
				0xfe,
				...[...'Ärtist'].flatMap((char) => [char.charCodeAt(0), 0]),
			]),
			...id3Frame('TALB', [0, ...ascii('Album')]),
			...id3Frame('APIC', [0, ...ascii('image/png'), 0, 3, 0, 1, 2, 3]),
		];
		const size = frames.length;
		const header = [
			...ascii('ID3'),
			3,
			0,
			0,
			(size >> 21) & 127,
			(size >> 14) & 127,
			(size >> 7) & 127,
			size & 127,
		];
		const tags = readTags(new Uint8Array([...header, ...frames]));

		expect(tags.title).toBe('Song');
		expect(tags.artist).toBe('Ärtist');
		expect(tags.album).toBe('Album');
		expect(tags.cover?.mime).toBe('image/png');
		expect([...(tags.cover?.bytes ?? [])]).toEqual([1, 2, 3]);
	});

	test('reads FLAC Vorbis comments', () => {
		const comments = ['TITLE=Track', 'ARTIST=Band']
			.map((entry) => [...le32(entry.length), ...ascii(entry)])
			.flat();
		const block = [...le32(3), ...ascii('lib'), ...le32(2), ...comments];
		const bytes = [
			...ascii('fLaC'),
			0x84,
			(block.length >> 16) & 255,
			(block.length >> 8) & 255,
			block.length & 255,
			...block,
		];

		expect(readTags(new Uint8Array(bytes))).toEqual({ title: 'Track', artist: 'Band' });
	});

	test('reads an M4A title when moov comes first', () => {
		const atom = (type: string, body: number[]) => [
			...be32(body.length + 8),
			...ascii(type),
			...body,
		];
		const data = atom('data', [0, 0, 0, 1, 0, 0, 0, 0, ...ascii('Tune')]);
		const ilst = atom('ilst', atom('©nam', data));
		const meta = atom('meta', [0, 0, 0, 0, ...ilst]);
		const bytes = [...atom('ftyp', ascii('M4A ')), ...atom('moov', atom('udta', meta))];

		expect(readTags(new Uint8Array(bytes)).title).toBe('Tune');
	});

	test('reads nothing from other files', () => {
		expect(readTags(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual({});
	});
});

describe('text', () => {
	test('decodes and encodes', () => {
		expect(utf8(new Uint8Array([0xe2, 0x82, 0xac]))).toBe('€');
		expect(utf16(new Uint8Array([0, 0x41]))).toBe('A');
		expect(base64(new Uint8Array([104, 105]))).toBe('aGk=');
	});
});
