import { afterEach, describe, expect, test } from 'bun:test';

import { isDebugLocalMessage } from '~/lib/local-messages';

afterEach(() => {
	Reflect.deleteProperty(globalThis, '__ubdLocalMessages');
});

describe('debug local messages', () => {
	test('recognises messages the debug command added in that channel', () => {
		Reflect.set(globalThis, '__ubdLocalMessages', { '709': ['1', '2'] });

		expect(isDebugLocalMessage('709', '2')).toBe(true);
		expect(isDebugLocalMessage('709', '3')).toBe(false);
		expect(isDebugLocalMessage('710', '1')).toBe(false);
	});

	test('treats every message as real without the registry', () => {
		expect(isDebugLocalMessage('709', '1')).toBe(false);
	});
});
