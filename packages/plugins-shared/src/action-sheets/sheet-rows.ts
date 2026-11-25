import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { assets } from '@unbound-app/api';
import { createElement, Fragment, type ReactNode } from 'react';

export type SheetRowSpec = {
	key: string;
	label: string;
	icon: string;
	onPress: () => void;
};

/** Key of the untitled section every plugin adds its rows to, so plugins share one section per sheet. */
export const UNBOUND_SECTION_KEY = 'unbound-sheet-rows';
const MAX_DEPTH = 15;

// UNKNOWN: an action sheet may render any node.
function placeAfter(node: unknown, target: object, section: object, depth: number = 0): boolean {
	if (depth > MAX_DEPTH || !isElementNode(node)) return false;

	if (Array.isArray(node)) {
		const index = node.indexOf(target);

		if (index !== -1) {
			node.splice(index + 1, 0, section);

			return true;
		}

		return node.some((child) => placeAfter(child, target, section, depth + 1));
	}

	const { props } = node;

	if (!props) return false;

	if (props.children === target) {
		props.children = [target, section];

		return true;
	}

	return placeAfter(props.children, target, section, depth + 1);
}

// A component that renders the group as its root leaves no list to place a section beside, so the group's element becomes a fragment of itself and the section.
function wrapWithSection(group: ElementNode, section: object): boolean {
	try {
		const original = { ...group };

		group.type = Fragment as unknown as ElementNode['type'];
		group.props = { children: [original, section] };

		return true;
	} catch {
		// A frozen development-build element: the caller falls back to the group's own rows.
		return false;
	}
}

// UNKNOWN: an action sheet may render any node.
function findRows(result: unknown): unknown[] | undefined {
	const existing = findElement(result, (element) => element.key === UNBOUND_SECTION_KEY);

	if (existing) return existing.props?.children as unknown[] | undefined;

	const group = findElement(result, isActionSheetRowGroup);

	if (!group) return undefined;

	const children: ReactNode[] = [];
	const section = createElement(getActionSheetRow().Group, {
		key: UNBOUND_SECTION_KEY,
		hasIcons: true,
		children,
	});

	if (placeAfter(result, group, section) || wrapWithSection(group, section)) return children;

	return Array.isArray(group.props?.children) ? group.props.children : undefined;
}

/**
 * @description Adds rows to the untitled section plugins share on an action sheet, once each, creating it after the sheet's first row group when no plugin has yet.
 * @param result One rendered level of the sheet.
 * @param specs The rows to add, keyed so a re-render does not add them twice.
 */
// UNKNOWN: an action sheet may render any node.
export function insertSheetRows(result: unknown, specs: readonly SheetRowSpec[]): void {
	if (!specs.length) return;

	const rows = findRows(result);

	if (!rows) return;

	const ActionSheetRow = getActionSheetRow();

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
