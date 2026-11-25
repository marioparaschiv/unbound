import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { sectionRows } from '@unbound-plugins/shared/action-sheets/sheet-section';
import { isElementNode } from '@unbound-plugins/shared/react/find-element';
import { assets } from '@unbound-app/api';
import { createElement } from 'react';

export type SheetRowSpec = {
	key: string;
	label: string;
	icon: string;
	onPress: () => void;
};

/**
 * @description Adds rows to the untitled section plugins share on an action sheet, once each, creating it after the sheet's first row group when no plugin has yet.
 * @param result One rendered level of the sheet.
 * @param specs The rows to add, keyed so a re-render does not add them twice.
 */
// UNKNOWN: an action sheet may render any node.
export function insertSheetRows(result: unknown, specs: readonly SheetRowSpec[]): void {
	if (!specs.length) return;

	const ActionSheetRow = getActionSheetRow();
	const rows = sectionRows(result, ActionSheetRow.Group);

	if (!rows) return;

	for (const spec of specs) {
		if (rows.some((row) => isElementNode(row) && row.key === spec.key)) {
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
