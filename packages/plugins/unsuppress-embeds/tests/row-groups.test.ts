import { describe, expect, test } from 'bun:test';

import { findTargetRows, insertionIndex, isDeleteRow } from '~/unsuppress/row-groups';

const noop = () => {};

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
	test('recognizes Discord destructive row whatever its label says', () => {
		expect(isDeleteRow(row('Delete Message', 'danger'))).toBe(true);
		expect(isDeleteRow(row('Eliminar mensaje', 'danger'))).toBe(true);
	});

	test('rejects a row that is not destructive, even when it is called Delete', () => {
		expect(isDeleteRow(row('Delete Message'))).toBe(false);
		expect(isDeleteRow(null)).toBe(false);
		expect(isDeleteRow([row('Reply', 'danger')])).toBe(false);
	});
});

describe('insertionIndex', () => {
	test('goes right above the delete row', () => {
		expect(insertionIndex([row('Reply'), row('Edit'), row('Borrar', 'danger')])).toBe(2);
	});

	test('goes at the end when there is no delete row', () => {
		expect(insertionIndex([row('Reply'), null, row('Copy Text')])).toBe(3);
	});
});

describe('findTargetRows', () => {
	test('picks the group that holds the delete row over earlier groups', () => {
		const first = group(row('Add Reaction'), row('Reply'));
		const second = group(row('Edit Message'), row('Supprimer le message', 'danger'));
		const rows = findTargetRows(sheet(first, second));

		expect(rows).toBe(second.props.children);
	});

	test('picks a nested delete group', () => {
		const deleteGroup = group(row('Copy Text'), row('Löschen', 'danger'));
		const nested = { type: 'View', props: { children: [deleteGroup] } };
		const rows = findTargetRows(sheet(group(row('Reply')), nested));

		expect(rows).toBe(deleteGroup.props.children);
	});

	test('falls back to the first group when no group holds a delete row', () => {
		const first = group(row('Reply'), row('Copy Text'));
		const rows = findTargetRows(sheet(first, group(row('Delete Message'))));

		expect(rows).toBe(first.props.children);
	});

	test('returns undefined when the sheet has no row group', () => {
		expect(findTargetRows(sheet({ type: 'Text', props: { children: 'hi' } }))).toBeUndefined();
		expect(findTargetRows(null)).toBeUndefined();
	});
});
