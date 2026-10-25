import { describe, expect, test } from 'bun:test';

import { pickKlipyGif } from './klipy';

const result = (slug: string, folder: string, file: string) => ({
	slug,
	file: {
		hd: {
			gif: { url: `https://static.klipy.com/ii/${folder}/${file}.gif` },
			mp4: { url: `https://static.klipy.com/ii/${folder}/${file}.mp4` },
		},
	},
});

const results = [
	result('sweet-dreams-good-night-sweet-dreams-8--kaE5YuM9Y', '935d7ab9/03/80', 'O8nhRr5K'),
	result('sweet-dreams-good-night-sweet-dreams-1--kaE5YuM9Y', 'e293a233/99/66', 'hNignVYE'),
	result('sweet-dreams-good-night-sweet-dreams-7--kaE5YuM9Y', '935d7ab9/58/18', 'nXvduRRk'),
];

describe('pickKlipyGif', () => {
	test('matches the media folder, not a result that only shares its first segment', () => {
		expect(pickKlipyGif(results, null, '935d7ab9/58/18')).toBe(
			'https://static.klipy.com/ii/935d7ab9/58/18/nXvduRRk.gif',
		);
	});

	test('falls back to the page slug', () => {
		expect(pickKlipyGif(results, 'sweet-dreams-good-night-sweet-dreams-1', null)).toBe(
			'https://static.klipy.com/ii/e293a233/99/66/hNignVYE.gif',
		);
	});

	test('never picks an unrelated result', () => {
		expect(pickKlipyGif(results, 'another-gif', '1234/ab/cd')).toBeNull();
		expect(pickKlipyGif(results, null, null)).toBeNull();
	});
});
