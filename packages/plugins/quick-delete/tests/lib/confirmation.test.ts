import { describe, expect, test } from 'bun:test';

import { isDeleteConfirmation } from '~/lib/confirmation';

const confirm = () => undefined;

describe('delete confirmation', () => {
	test('matches the delete-message alert', () => {
		expect(
			isDeleteConfirmation({ title: 'Delete Message', onConfirm: confirm }, 'Delete Message'),
		).toBe(true);
	});

	test('leaves other alerts alone', () => {
		expect(
			isDeleteConfirmation({ title: 'Leave Server', onConfirm: confirm }, 'Delete Message'),
		).toBe(false);
		expect(isDeleteConfirmation({ title: 'Delete Message' }, 'Delete Message')).toBe(false);
		expect(isDeleteConfirmation(undefined, 'Delete Message')).toBe(false);
	});
});
