import { expect, test } from 'bun:test';

import { contentHash } from '~/lib/content-hash';

import { ADDON } from './helpers/fake-reads';

test('key order does not change the hash; any visible field does', () => {
	const { gallery, iconSvg, installUrl, sourceUrl, listed, pageUrl, authors, ...rest } = ADDON;
	const reordered = {
		listed,
		pageUrl,
		authors,
		gallery,
		iconSvg,
		installUrl,
		sourceUrl,
		...rest,
	};

	expect(contentHash(reordered)).toBe(contentHash(ADDON));
	expect(contentHash({ ...ADDON, version: '1.0.1' })).not.toBe(contentHash(ADDON));
	expect(
		contentHash({
			...ADDON,
			gallery: [{ url: 'https://cdn/a.png', width: 1, height: 2, alt: 'A' }],
		}),
	).not.toBe(contentHash(ADDON));
});

test('no avatars hash as the listing alone; a changed avatar emoji changes the hash', () => {
	expect(contentHash(ADDON, {})).toBe(contentHash(ADDON));
	expect(contentHash(ADDON, { 1: 'av_1_aaaa' })).not.toBe(contentHash(ADDON));
	expect(contentHash(ADDON, { 1: 'av_1_bbbb' })).not.toBe(contentHash(ADDON, { 1: 'av_1_aaaa' }));
});
