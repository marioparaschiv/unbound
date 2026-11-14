import { describe, expect, test } from 'bun:test';

import { parseSpeed } from '~/lib/speed';

describe('voice message speed', () => {
	test('reads the setting, falling back to normal speed', () => {
		expect(parseSpeed('1.5')).toBe(1.5);
		expect(parseSpeed('fast')).toBe(1);
		expect(parseSpeed('10')).toBe(1);
	});
});
