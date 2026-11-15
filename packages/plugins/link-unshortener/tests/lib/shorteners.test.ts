import { describe, expect, test } from 'bun:test';

import { isShortLink, resolveLink } from '~/lib/shorteners';

describe('isShortLink', () => {
	test('knows shortener hosts', () => {
		expect(isShortLink('https://bit.ly/abc')).toBe(true);
		expect(isShortLink('http://www.tinyurl.com/x')).toBe(true);
		expect(isShortLink('https://unbound.rip/docs')).toBe(false);
	});
});

describe('resolveLink', () => {
	test('follows redirects, including relative ones, to the end', async () => {
		const hops: Record<string, string> = {
			'https://bit.ly/a': 'https://t.co/b',
			'https://t.co/b': '/final?x=1',
		};
		const request = async (url: string) => ({
			status: hops[url] ? 301 : 200,
			headers: { get: () => hops[url] ?? null },
		});

		expect(await resolveLink('https://bit.ly/a', request)).toEqual({
			url: 'https://t.co/final?x=1',
			redirects: 2,
		});
	});

	test('takes the final address when the platform followed the redirects itself', async () => {
		const request = async () => ({
			status: 200,
			url: 'https://unbound.rip/',
			headers: { get: () => null },
		});

		expect(await resolveLink('https://bit.ly/a', request)).toEqual({
			url: 'https://unbound.rip/',
			redirects: 1,
		});
	});
});
