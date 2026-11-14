import { describe, expect, test } from 'bun:test';

import { composerState } from '../../src/composer/composer-layout';

describe('composerState', () => {
	test('is empty without text or attachments', () => {
		expect(composerState('', 0, 20)).toBe('empty');
		expect(composerState('   ', 0, 20)).toBe('empty');
	});

	test('is short for a draft or an attachment that fits on one line', () => {
		expect(composerState('hello', 0, 20)).toBe('short');
		expect(composerState('', 1, 20)).toBe('short');
	});

	test('is crowded once the draft wraps or spans lines', () => {
		expect(composerState('a'.repeat(21), 0, 20)).toBe('crowded');
		expect(composerState('one\ntwo', 0, 20)).toBe('crowded');
	});
});
