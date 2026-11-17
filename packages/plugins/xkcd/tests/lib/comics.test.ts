import { describe, expect, test } from 'bun:test';

import { createXkcd, parseArchive, parseRequest, searchArchive, toComic } from '~/lib/comics';

const archiveHtml = `<a href="/3325/" title="2026-11-16">Light-Day</a>
<a href="/927/" title="2011-7-20">Standards</a>
<a href="/353/" title="2007-12-5">Python &amp; Friends</a>`;

describe('xkcd', () => {
	test('reads a comic, and refuses one without an image', () => {
		expect(
			toComic({
				num: 927,
				safe_title: 'Standards',
				alt: 'a',
				img: 'https://imgs.xkcd.com/x.png',
				year: '2011',
				month: '7',
				day: '20',
			}),
		).toEqual({
			num: 927,
			title: 'Standards',
			alt: 'a',
			img: 'https://imgs.xkcd.com/x.png',
			date: '2011-07-20',
		});
		expect(toComic({ num: 1 })).toBeUndefined();
	});

	test('reads and searches the archive', () => {
		const archive = parseArchive(archiveHtml);

		expect(archive).toHaveLength(3);
		expect(archive[2]).toEqual({ num: 353, title: 'Python & Friends' });
		expect(searchArchive(archive, 'standards').map((entry) => entry.num)).toEqual([927]);
		expect(searchArchive(archive, 'friends python').map((entry) => entry.num)).toEqual([353]);
	});

	test('reads what /xkcd asks for', () => {
		expect(parseRequest(undefined)).toEqual({ kind: 'latest' });
		expect(parseRequest('#927')).toEqual({ kind: 'number', num: 927 });
		expect(parseRequest('Random')).toEqual({ kind: 'random' });
		expect(parseRequest('standards')).toEqual({ kind: 'search', query: 'standards' });
	});

	test('caches comics it loaded', async () => {
		let calls = 0;
		const xkcd = createXkcd(async () => {
			calls++;

			return {
				ok: true,
				json: async () => ({ num: 5, img: 'i', safe_title: 't' }),
				text: async () => '',
			};
		});

		await xkcd.comic(5);
		await xkcd.comic(5);

		expect(calls).toBe(1);
	});
});
