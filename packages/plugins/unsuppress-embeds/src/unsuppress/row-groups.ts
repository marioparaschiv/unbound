import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';

/**
 * @description Recognizes Discord's delete row without its label, which changes with the language. Discord builds the delete row, and the other destructive rows, with `variant: 'danger'`.
 * @param row Any child of a row group.
 * @returns `true` for a destructive row.
 */
export function isDeleteRow(
	// UNKNOWN: sheet rows are untyped React elements.
	row: unknown,
): boolean {
	if (!isElementNode(row) || Array.isArray(row)) return false;

	// UNKNOWN: the shared element type does not list `variant`.
	return (row.props as { variant?: unknown } | undefined)?.variant === 'danger';
}

/**
 * @description Finds where the row goes: just above Discord's delete row, or at the end when there is none.
 * @param rows The rows of the sheet's group, in order.
 * @returns The index to insert the row at.
 */
export function insertionIndex(
	// UNKNOWN: sheet rows are untyped React elements.
	rows: readonly unknown[],
): number {
	const deleteIndex = rows.findIndex(isDeleteRow);

	return deleteIndex === -1 ? rows.length : deleteIndex;
}

function holdsDeleteRow(element: ElementNode): boolean {
	if (!isActionSheetRowGroup(element)) return false;

	const children = element.props?.children;

	return Array.isArray(children) && children.some(isDeleteRow);
}

/**
 * @description Finds the row group that holds Discord's delete row, falling back to the first row group.
 * @param result An action sheet's render result.
 * @returns The rows of that group, or `undefined` when the sheet has no row group.
 */
export function findTargetRows(
	// UNKNOWN: an action sheet may render any node.
	result: unknown,
	// UNKNOWN: rows are untyped React elements.
): unknown[] | undefined {
	const group = findElement(result, holdsDeleteRow) ?? findElement(result, isActionSheetRowGroup);
	const rows = group?.props?.children;

	return Array.isArray(rows) ? rows : undefined;
}

export default { isDeleteRow, insertionIndex, findTargetRows };
