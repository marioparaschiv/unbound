import { describe, expect, test } from 'bun:test';

import { createNameCache } from '~/lib/name-cache';

describe('name cache', () => {
	test('cleans like cleanChannelName and returns the same value again', () => {
		const cache = createNameCache();

		expect(cache.clean('📢・ɴᴇᴡꜱ-ᴀɴᴅ-ɪɴꜰᴏ', 0, { spaces: false })).toBe('news-and-info');
		expect(cache.clean('📢・ɴᴇᴡꜱ-ᴀɴᴅ-ɪɴꜰᴏ', 0, { spaces: true })).toBe('news and info');
		expect(cache.clean('📢・ɴᴇᴡꜱ-ᴀɴᴅ-ɪɴꜰᴏ', 0, { spaces: false })).toBe('news-and-info');
	});

	test('rereads the kept list when it changes', () => {
		const cache = createNameCache();

		expect(cache.isKept('1', '1, 2')).toBe(true);
		expect(cache.isKept('3', '1, 2')).toBe(false);
		expect(cache.isKept('3', '3')).toBe(true);
		expect(cache.isKept('1', '3')).toBe(false);
	});
});
