import { describe, expect, test } from 'bun:test';

import { decorateRow, type ChatRow, type RowDecoration } from '~/rows/decorate';

const none: RowDecoration = {
	deleted: false,
	redText: true,
	deletedMarker: true,
	deletedColor: 0xfff23f42,
	dismissTarget: null,
	previousVersions: [],
	deletedAttachmentIds: new Set(),
};

function row(): ChatRow {
	return {
		message: {
			id: '1',
			textColor: 1,
			content: [{ type: 'text', content: 'now' }],
			attachments: [
				{ id: 'a', filename: 'a.png' },
				{ id: 'b', filename: 'b.png' },
			],
		},
	};
}

describe('decorateRow', () => {
	test('shows a deleted message in red with a deleted marker and dismiss link', () => {
		const target = row();

		decorateRow(target, { ...none, deleted: true, dismissTarget: { id: '1' } });

		expect(target.message?.textColor).toBe(0xfff23f42);
		expect(JSON.stringify(target.message?.ephemeralIndication)).toContain(
			'This message was deleted',
		);
		expect(JSON.stringify(target.message?.ephemeralIndication)).toContain('bindDismissMessage');
		expect(target.message?.attachments?.map((attachment) => attachment.filename)).toEqual([
			'(deleted) a.png',
			'(deleted) b.png',
		]);
	});

	test('respects the red text and marker switches', () => {
		const target = row();

		decorateRow(target, { ...none, deleted: true, redText: false, deletedMarker: false });

		expect(target.message?.textColor).toBe(1);
		expect(target.message?.ephemeralIndication).toBeUndefined();
	});

	test('puts earlier versions above the current text', () => {
		const target = row();

		decorateRow(target, { ...none, previousVersions: [[{ type: 'text', content: 'before' }]] });

		expect(target.message?.content).toEqual([
			{ type: 'text', content: 'before' },
			{ type: 'text', content: ' (edited)\n' },
			{ type: 'text', content: 'now' },
		]);
	});

	test('marks only the attachments an edit removed', () => {
		const target = row();

		decorateRow(target, { ...none, deletedAttachmentIds: new Set(['b']) });

		expect(target.message?.attachments?.map((attachment) => attachment.filename)).toEqual([
			'a.png',
			'(deleted) b.png',
		]);
	});

	test('leaves an unlogged row alone', () => {
		const target = row();

		decorateRow(target, none);

		expect(target).toEqual(row());
	});
});
