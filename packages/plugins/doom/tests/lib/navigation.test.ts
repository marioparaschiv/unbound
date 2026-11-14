import { describe, expect, test } from 'bun:test';

import { staysOnGame } from '~/lib/navigation';

describe('staysOnGame', () => {
	test('loads the game and its own pages', () => {
		expect(staysOnGame('https://silentspacemarine.com/')).toBe(true);
		expect(staysOnGame('https://silentspacemarine.com/doom.wasm')).toBe(true);
		expect(staysOnGame('about:blank')).toBe(true);
	});

	test('keeps other sites out, including look-alike hosts', () => {
		expect(staysOnGame('https://example.com/')).toBe(false);
		expect(staysOnGame('https://silentspacemarine.com.evil.test/')).toBe(false);
	});
});
