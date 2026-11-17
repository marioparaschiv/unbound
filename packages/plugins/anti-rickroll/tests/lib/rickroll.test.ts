import { describe, expect, test } from 'bun:test';

import { isRickroll, needsCheck, youtubeId, type Fetcher } from '~/lib/rickroll';

function fakeFetch(routes: Record<string, { url?: string; body?: object; ok?: boolean }>): Fetcher {
	return async (url) => {
		const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];

		return {
			ok: route?.ok ?? Boolean(route),
			url: route?.url ?? url,
			json: async () => route?.body ?? {},
		};
	};
}

describe('anti rickroll', () => {
	test('reads YouTube ids from every link shape', () => {
		expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
		expect(youtubeId('https://www.youtube.com/watch?v=abc123&list=x')).toBe('abc123');
		expect(youtubeId('https://m.youtube.com/shorts/xyz789A')).toBe('xyz789A');
		expect(youtubeId('https://example.com/watch?v=abc')).toBeUndefined();
	});

	test('checks only videos, short links and prank sites', () => {
		expect(needsCheck('https://bit.ly/3abc')).toBe(true);
		expect(needsCheck('https://youtu.be/x')).toBe(true);
		expect(needsCheck('https://github.com/x')).toBe(false);
	});

	test('warns for known videos without asking YouTube', async () => {
		expect(await isRickroll('https://youtu.be/dQw4w9WgXcQ', fakeFetch({}))).toBe(true);
	});

	test('warns for reuploads by their title', async () => {
		const fetcher = fakeFetch({
			'https://www.youtube.com/oembed': {
				body: { title: 'Totally real tutorial (never gonna give you up)' },
			},
		});

		expect(await isRickroll('https://youtu.be/other00001', fetcher)).toBe(true);
	});

	test('follows short links', async () => {
		const fetcher = fakeFetch({ 'https://bit.ly/': { url: 'https://youtu.be/dQw4w9WgXcQ' } });

		expect(await isRickroll('https://bit.ly/abc', fetcher)).toBe(true);
	});

	test('lets ordinary videos and unreachable checks through', async () => {
		const fetcher = fakeFetch({
			'https://www.youtube.com/oembed': { body: { title: 'Cat video' } },
		});
		const failing: Fetcher = async () => {
			throw new Error('offline');
		};

		expect(await isRickroll('https://youtu.be/cat0000001', fetcher)).toBe(false);
		expect(await isRickroll('https://youtu.be/cat0000001', failing)).toBe(false);
	});
});
