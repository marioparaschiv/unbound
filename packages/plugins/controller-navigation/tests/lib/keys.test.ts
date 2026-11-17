import { describe, expect, test } from 'bun:test';

import { KEY_ACTIONS, stepThrough } from '~/lib/keys';

describe('controller keys', () => {
	test('map the D-pad and buttons', () => {
		expect(KEY_ACTIONS[19]).toBe('previousChannel');
		expect(KEY_ACTIONS[103]).toBe('nextUnread');
		expect(KEY_ACTIONS[97]).toBeUndefined();
	});

	test('step through a list, wrapping and skipping what does not qualify', () => {
		expect(stepThrough(['a', 'b', 'c'], 'c', 1)).toBe('a');
		expect(stepThrough(['a', 'b', 'c'], 'a', -1)).toBe('c');
		expect(stepThrough(['a', 'b', 'c', 'd'], 'a', 1, (item) => item === 'd')).toBe('d');
		expect(stepThrough(['a'], 'a', 1)).toBeUndefined();
		expect(stepThrough(['a', 'b'], undefined, 1)).toBe('a');
	});
});
