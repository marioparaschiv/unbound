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

	test('stays crowded until the draft is clearly shorter than a line', () => {
		expect(composerState('a'.repeat(17), 0, 20, 'crowded')).toBe('crowded');
		expect(composerState('a'.repeat(14), 0, 20, 'crowded')).toBe('short');
		expect(composerState('a'.repeat(15), 0, 20, 'short')).toBe('short');
	});

	test('is crowded whenever the buttons leave too little room', () => {
		expect(composerState('hi', 0, 2)).toBe('crowded');
		expect(composerState('hi', 0, 2, 'crowded')).toBe('crowded');
	});
});
