import { describe, expect, test } from 'bun:test';

import { findTargetRows, insertionIndex, isDeleteRow } from '~/unsuppress/row-groups';

const noop = () => {};
const DELETE = 'Supprimer le message';

function row(label: string, variant?: string) {
	return { type: 'Row', key: label, props: { label, variant, onPress: noop } };
}

function group(...rows: object[]) {
	return { type: () => null, props: { hasIcons: true, children: rows } };
}

function sheet(...groups: object[]) {
	return { type: 'View', props: { children: groups } };
}

describe('isDeleteRow', () => {
	test('recognizes the row that carries Discord Delete Message label', () => {
		expect(isDeleteRow(row(DELETE, 'danger'), DELETE)).toBe(true);
	});

	test('rejects the other destructive rows, which share its variant', () => {
		expect(isDeleteRow(row('Signaler le message', 'danger'), DELETE)).toBe(false);
		expect(isDeleteRow(null, DELETE)).toBe(false);
		expect(isDeleteRow([row(DELETE, 'danger')], DELETE)).toBe(false);
	});
});

describe('insertionIndex', () => {
	test('goes right above the delete row, not above Report Message', () => {
		const rows = [row('Reply'), row('Report Message', 'danger'), row(DELETE, 'danger')];

		expect(insertionIndex(rows, DELETE)).toBe(2);
	});

	test('goes at the end when there is no delete row', () => {
		expect(insertionIndex([row('Reply'), null, row('Copy Text')], DELETE)).toBe(3);
	});
});

describe('findTargetRows', () => {
	test('picks the group that holds the delete row over earlier groups', () => {
		const first = group(row('Add Reaction'), row('Reply'));
		const second = group(row('Edit Message'), row(DELETE, 'danger'));
		const rows = findTargetRows(sheet(first, second), DELETE);

		expect(rows).toBe(second.props.children);
	});

	test('picks a nested delete group', () => {
		const deleteGroup = group(row('Copy Text'), row(DELETE, 'danger'));
		const nested = { type: 'View', props: { children: [deleteGroup] } };
		const rows = findTargetRows(sheet(group(row('Reply')), nested), DELETE);

		expect(rows).toBe(deleteGroup.props.children);
	});

	test('falls back to the first group when no group holds a delete row', () => {
		const first = group(row('Reply'), row('Copy Text'));
		const rows = findTargetRows(sheet(first, group(row('Report Message', 'danger'))), DELETE);

		expect(rows).toBe(first.props.children);
	});

	test('returns undefined when the sheet has no row group', () => {
		expect(
			findTargetRows(sheet({ type: 'Text', props: { children: 'hi' } }), DELETE),
		).toBeUndefined();
		expect(findTargetRows(null, DELETE)).toBeUndefined();
	});
});
