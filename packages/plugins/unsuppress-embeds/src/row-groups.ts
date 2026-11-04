import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';

import { isDeleteLabel } from '~/embeds';

/**
 * @description Reads the label of an action sheet row.
 * @param row Any child of a row group.
 * @returns The row's label, or `undefined` when it has none.
 */
export function rowLabel(
	// UNKNOWN: sheet rows are untyped React elements.
	row: unknown,
): string | undefined {
	if (!isElementNode(row) || Array.isArray(row)) return undefined;

	const label = row.props?.label;

	return typeof label === 'string' ? label : undefined;
}

function holdsDeleteRow(element: ElementNode): boolean {
	if (!isActionSheetRowGroup(element)) return false;

	const children = element.props?.children;

	return Array.isArray(children) && children.some((row) => isDeleteLabel(rowLabel(row)));
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

export default { rowLabel, findTargetRows };
