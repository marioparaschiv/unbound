import { describe, expect, test } from 'bun:test';

import { editedLabel } from '~/lib/highlight';

describe('editedLabel', () => {
	test('uses what the user typed, with a leading space', () => {
		expect(editedLabel('  [was edited] ', ' (edited)')).toBe(' [was edited]');
	});

	test("falls back to Discord's label", () => {
		expect(editedLabel('', ' (edited)')).toBe(' (edited)');
	});
});
