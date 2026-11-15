import { describe, expect, test } from 'bun:test';

import { forcedChangeType } from '~/plugins/chat-change-type';

describe('forcedChangeType', () => {
	test('redraws rows Discord would leave untouched', () => {
		expect(forcedChangeType(0)).toBe(1);
	});

	test('keeps the change Discord chose for other rows', () => {
		expect(forcedChangeType(1)).toBe(1);
		expect(forcedChangeType(3)).toBe(3);
	});
});
