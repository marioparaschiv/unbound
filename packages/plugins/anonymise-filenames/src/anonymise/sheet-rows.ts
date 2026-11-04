import { isElementNode } from '@unbound-plugins/shared/react/find-element';

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

/**
 * @description Recognizes an element whose children include pressable or switchable labelled rows, as an action sheet's row list does.
 * @param element Any element from an action sheet's render result.
 * @returns `true` when at least one child is a labelled row.
 */
export function holdsRows(element: { props?: { children?: unknown } }): boolean {
	const children = element.props?.children;

	return Array.isArray(children) && children.some(isLabelledRow);
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
