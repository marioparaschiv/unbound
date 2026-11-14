import { describe, expect, test } from 'bun:test';

import { parseEdits, withEdit } from '~/lib/edits';

const id = '1234567890123456789';

describe('local edits', () => {
	test('keeps only message ids with text', () => {
		expect(parseEdits({ [id]: 'hi', nope: 'x', '1234567890123456780': 5 })).toEqual({
			[id]: 'hi',
		});
		expect(parseEdits(['x'])).toEqual({});
		expect(parseEdits(null)).toEqual({});
	});

	test('saves new text and clears an edit back to the original or to nothing', () => {
		const edited = withEdit({}, id, 'changed', 'original');

		expect(edited).toEqual({ [id]: 'changed' });
		expect(withEdit(edited, id, 'original', 'original')).toEqual({});
		expect(withEdit(edited, id, '   ', 'original')).toEqual({});
	});
});
