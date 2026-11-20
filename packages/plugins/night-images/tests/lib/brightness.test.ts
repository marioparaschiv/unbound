import { describe, expect, test } from 'bun:test';

import { placeholderLightness } from '~/lib/brightness';

describe('placeholderLightness', () => {
	test('reads a dark screenshot as dark', () => {
		expect(placeholderLightness('yPeBBYAPTHZ4eHaa+Lxw21kJAwNjYzAwBg==')).toBeLessThan(0.4);
	});

	test('rejects text that is not a hash', () => {
		expect(placeholderLightness('not base64!')).toBeUndefined();
		expect(placeholderLightness('AA==')).toBeUndefined();
	});
});
