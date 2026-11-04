import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';

type RowProps = {
	label?: unknown;
	onPress?: unknown;
	onValueChange?: unknown;
};

function isLabelledRow(value: unknown): boolean {
	if (!isElementNode(value) || Array.isArray(value)) return false;

	const props = value.props as RowProps | undefined;

	return (
		typeof props?.label === 'string' &&
		(typeof props.onPress === 'function' || typeof props.onValueChange === 'function')
	);
}

function holdsRows(element: ElementNode): boolean {
	const children = element.props?.children;

	return Array.isArray(children) && children.some(isLabelledRow);
}

/**
 * @description Finds the list of rows an action sheet renders: its row group, or else the first element whose children include pressable or switchable rows.
 * @param result The sheet's render result.
 * @returns The mutable array of rows, or `undefined` when the sheet has none.
 */
export function findSheetRows(result: unknown): unknown[] | undefined {
	const group = findElement(result, isActionSheetRowGroup) ?? findElement(result, holdsRows);
	const rows = group?.props?.children;

	return Array.isArray(rows) ? rows : undefined;
}

/**
 * @description Adds a row to a list of sheet rows unless a row with the same key is already there.
 * @param rows The sheet's rows.
 * @param row The row to add, keyed.
 * @param key The row's key.
 */
export function insertRowOnce(rows: unknown[], row: unknown, key: string): void {
	if (rows.some((existing) => isElementNode(existing) && existing.key === key)) return;

	rows.push(row);
}

export default { findSheetRows, insertRowOnce };
