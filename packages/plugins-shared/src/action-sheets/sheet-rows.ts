import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import { findElement } from '@unbound-plugins/shared/react/find-element';
import { assets } from '@unbound-app/api';
import { createElement } from 'react';

export type SheetRowSpec = {
	key: string;
	label: string;
	icon: string;
	onPress: () => void;
};

/**
 * @description Appends rows to the first row group an action sheet renders, once each.
 * @param result One rendered level of the sheet.
 * @param specs The rows to add, keyed so a re-render does not add them twice.
 */
// UNKNOWN: an action sheet may render any node.
export function insertSheetRows(result: unknown, specs: readonly SheetRowSpec[]): void {
	const rows = findElement(result, isActionSheetRowGroup)?.props?.children;

	if (!Array.isArray(rows) || !specs.length) return;

	const ActionSheetRow = getActionSheetRow();

	for (const spec of specs) {
		if (rows.some((row) => row?.key === spec.key)) {
			continue;
		}

		const icon = assets.getIdByName(spec.icon);

		rows.push(
			createElement(ActionSheetRow, {
				key: spec.key,
				label: spec.label,
				icon: icon ? createElement(ActionSheetRow.Icon, { source: icon }) : undefined,
				onPress: spec.onPress,
			}),
		);
	}
}

export default insertSheetRows;
