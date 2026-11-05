import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';

/**
 * @description Recognizes Discord's delete row by its label. The `danger` variant is shared with Report Message and others, so it cannot tell them apart.
 * @param row Any child of a row group.
 * @param deleteLabel Discord's "Delete Message" label in the user's language.
 * @returns `true` for the delete row.
 */
export function isDeleteRow(
	// UNKNOWN: sheet rows are untyped React elements.
	row: unknown,
	deleteLabel: string,
): boolean {
	if (!isElementNode(row) || Array.isArray(row)) return false;

	return row.props?.label === deleteLabel;
}

/**
 * @description Finds where the row goes: just above Discord's delete row, or at the end when there is none.
 * @param rows The rows of the sheet's group, in order.
 * @param deleteLabel Discord's "Delete Message" label in the user's language.
 * @returns The index to insert the row at.
 */
export function insertionIndex(
	// UNKNOWN: sheet rows are untyped React elements.
	rows: readonly unknown[],
	deleteLabel: string,
): number {
	const deleteIndex = rows.findIndex((row) => isDeleteRow(row, deleteLabel));

	return deleteIndex === -1 ? rows.length : deleteIndex;
}

function holdsDeleteRow(element: ElementNode, deleteLabel: string): boolean {
	if (!isActionSheetRowGroup(element)) return false;

	const children = element.props?.children;

	return Array.isArray(children) && children.some((row) => isDeleteRow(row, deleteLabel));
}

/**
 * @description Finds the row group that holds Discord's delete row, falling back to the first row group.
 * @param result An action sheet's render result.
 * @param deleteLabel Discord's "Delete Message" label in the user's language.
 * @returns The rows of that group, or `undefined` when the sheet has no row group.
 */
export function findTargetRows(
	// UNKNOWN: an action sheet may render any node.
	result: unknown,
	deleteLabel: string,
	// UNKNOWN: rows are untyped React elements.
): unknown[] | undefined {
	const group =
		findElement(result, (element) => holdsDeleteRow(element, deleteLabel)) ??
		findElement(result, isActionSheetRowGroup);
	const rows = group?.props?.children;

	return Array.isArray(rows) ? rows : undefined;
}

export default { isDeleteRow, insertionIndex, findTargetRows };
