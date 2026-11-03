import { describe, expect, test } from 'bun:test';

import { findTargetRows, rowLabel } from '~/row-groups';

const noop = () => {};

function row(label: string) {
	return { type: 'Row', key: label, props: { label, onPress: noop } };
}

function group(...labels: string[]) {
	return { type: () => null, props: { hasIcons: true, children: labels.map(row) } };
}

function sheet(...groups: object[]) {
	return { type: 'View', props: { children: groups } };
}

describe('rowLabel', () => {
	test('reads a row label', () => {
		expect(rowLabel(row('Reply'))).toBe('Reply');
	});

	test('ignores nodes without a label', () => {
		expect(rowLabel(null)).toBeUndefined();
		expect(rowLabel([row('Reply')])).toBeUndefined();
		expect(rowLabel({ props: { label: 3 } })).toBeUndefined();
	});
});

describe('findTargetRows', () => {
	test('picks the group that holds Delete over earlier groups', () => {
		const first = group('Add Reaction', 'Reply');
		const second = group('Edit Message', 'Delete Message');
		const rows = findTargetRows(sheet(first, second));

		expect(rows).toBe(second.props.children);
	});

	test('picks a nested delete group', () => {
		const deleteGroup = group('Copy Text', 'Delete Message');
		const nested = { type: 'View', props: { children: [deleteGroup] } };
		const rows = findTargetRows(sheet(group('Reply'), nested));

		expect(rows).toBe(deleteGroup.props.children);
	});

	test('falls back to the first group when no group holds Delete', () => {
		const first = group('Reply', 'Copy Text');
		const rows = findTargetRows(sheet(first, group('Report Message')));

		expect(rows).toBe(first.props.children);
	});

	test('does not treat Undelete as the delete row', () => {
		const first = group('Reply');
		const rows = findTargetRows(sheet(first, group('Undelete')));

		expect(rows).toBe(first.props.children);
	});

	test('returns undefined when the sheet has no row group', () => {
		expect(findTargetRows(sheet({ type: 'Text', props: { children: 'hi' } }))).toBeUndefined();
		expect(findTargetRows(null)).toBeUndefined();
	});
});
