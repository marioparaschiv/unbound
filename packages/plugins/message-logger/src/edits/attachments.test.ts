import { describe, expect, test } from 'bun:test';

import { keepRemovedAttachments } from '~/edits/attachments';

const a = { id: 'a' };
const b = { id: 'b' };
const c = { id: 'c' };

describe('keepRemovedAttachments', () => {
	test('leaves an edit that does not touch attachments alone', () => {
		expect(keepRemovedAttachments([a], undefined)).toEqual({
			attachments: undefined,
			removedIds: [],
		});
	});

	test('keeps removed attachments in place and reports them', () => {
		expect(keepRemovedAttachments([a, b], [b])).toEqual({
			attachments: [a, b],
			removedIds: ['a'],
		});
	});

	test('appends attachments the edit added', () => {
		expect(keepRemovedAttachments([a, b], [b, c])).toEqual({
			attachments: [a, b, c],
			removedIds: ['a'],
		});
	});

	test('keeps every attachment when an edit removes them all', () => {
		expect(keepRemovedAttachments([a, b], [])).toEqual({
			attachments: [a, b],
			removedIds: ['a', 'b'],
		});
	});
});
