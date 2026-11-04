import { describe, expect, test } from 'bun:test';

import {
	brandingUrl,
	cleanTitle,
	embedVideoId,
	parseBranding,
	thumbnailUrl,
	videoIdFromUrl,
} from '~/branding';

const ID = 'dQw4w9WgXcQ';

describe('videoIdFromUrl', () => {
	test.each([
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/embed/${ID}?start=10`,
		`https://www.youtube.com/watch?v=${ID}&t=5`,
		`https://m.youtube.com/watch?v=${ID}`,
		`https://music.youtube.com/watch?v=${ID}`,
		`https://youtube.com/shorts/${ID}`,
		`https://www.youtube.com/live/${ID}`,
		`https://youtu.be/${ID}`,
		`https://youtu.be/${ID}?si=abc`,
		`https://www.youtube-nocookie.com/embed/${ID}`,
	])('reads %s', (url) => {
		expect(videoIdFromUrl(url)).toBe(ID);
	});

	test.each([
		undefined,
		42,
		'not a url',
		'https://example.com/watch?v=dQw4w9WgXcQ',
		'https://www.youtube.com/watch?v=short',
		'https://www.youtube.com/embed/tooshort',
		'https://www.youtube.com/channel/UC123',
		'https://www.youtube.com/playlist?list=PL123',
	])('rejects %p', (url) => {
		expect(videoIdFromUrl(url)).toBeUndefined();
	});
});

describe('embedVideoId', () => {
	test('reads the video URL of a YouTube embed', () => {
		expect(
			embedVideoId({
				provider: { name: 'YouTube' },
				video: { url: `https://www.youtube.com/embed/${ID}` },
			}),
		).toBe(ID);
	});

	test('falls back to the embed link', () => {
		expect(
			embedVideoId({
				provider: { name: 'YouTube' },
				url: `https://www.youtube.com/watch?v=${ID}`,
			}),
		).toBe(ID);
	});

	test('skips embeds from other providers', () => {
		expect(
			embedVideoId({
				provider: { name: 'Vimeo' },
				video: { url: `https://www.youtube.com/embed/${ID}` },
			}),
		).toBeUndefined();
		expect(
			embedVideoId({ video: { url: `https://www.youtube.com/embed/${ID}` } }),
		).toBeUndefined();
		expect(embedVideoId(null)).toBeUndefined();
	});
});

describe('cleanTitle', () => {
	test('drops the casing markers', () => {
		expect(cleanTitle('>iPhone review of the >GPU')).toBe('iPhone review of the GPU');
	});

	test('keeps a lone or inner arrow', () => {
		expect(cleanTitle('a > b')).toBe('a > b');
		expect(cleanTitle('x>y')).toBe('x>y');
	});
});

describe('urls', () => {
	test('builds the thumbnail URL', () => {
		expect(thumbnailUrl(ID, 12.5)).toBe(
			`https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${ID}&time=12.5`,
		);
	});

	test('builds the branding URL', () => {
		expect(brandingUrl(ID)).toBe(`https://sponsor.ajay.app/api/branding?videoID=${ID}`);
	});
});

describe('parseBranding', () => {
	test('picks the top title and thumbnail', () => {
		expect(
			parseBranding(ID, {
				titles: [{ title: '>Rick Astley sings a song', votes: 3, original: false }],
				thumbnails: [{ timestamp: 42, votes: 0, original: false }],
			}),
		).toEqual({ title: 'Rick Astley sings a song', thumbnail: thumbnailUrl(ID, 42) });
	});

	test('skips entries with negative votes', () => {
		expect(
			parseBranding(ID, {
				titles: [{ title: 'Bad', votes: -1 }],
				thumbnails: [{ timestamp: 1, votes: 2 }],
			}),
		).toEqual({ thumbnail: thumbnailUrl(ID, 1) });
	});

	test('skips the original thumbnail', () => {
		expect(
			parseBranding(ID, {
				titles: [{ title: 'Good', votes: 0 }],
				thumbnails: [{ original: true, votes: 5 }],
			}),
		).toEqual({ title: 'Good' });
	});

	test('returns null when there is nothing to replace', () => {
		expect(parseBranding(ID, { titles: [], thumbnails: [] })).toBeNull();
		expect(parseBranding(ID, { titles: [{ title: '  ', votes: 1 }] })).toBeNull();
		expect(parseBranding(ID, { titles: [{ title: 'No votes' }] })).toBeNull();
		expect(parseBranding(ID, null)).toBeNull();
		expect(parseBranding(ID, 'nope')).toBeNull();
	});
});
