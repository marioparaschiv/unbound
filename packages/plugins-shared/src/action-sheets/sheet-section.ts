import { isActionSheetRowGroup } from '@unbound-plugins/shared/action-sheets/row-group';
import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import { createElement, Fragment, type ComponentType, type ReactNode } from 'react';

type GroupComponent = ComponentType<{ hasIcons?: boolean; children?: ReactNode }>;

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

/**
 * @description Finds the rows of the untitled section plugins share on an action sheet, creating it after the sheet's first row group when no plugin has yet.
 * @param result One rendered level of the sheet.
 * @param Group The row group component the section renders with.
 * @returns The section's rows to add to, Discord's first group's rows when no section fits, or `undefined` when the level has no row group.
 */
// UNKNOWN: an action sheet may render any node.
export function sectionRows(result: unknown, Group: GroupComponent): unknown[] | undefined {
	const existing = findElement(result, (element) => element.key === UNBOUND_SECTION_KEY);

	if (existing) return existing.props?.children as unknown[] | undefined;

	const group = findElement(result, isActionSheetRowGroup);

	if (!group) return undefined;

	const children: ReactNode[] = [];
	const section = createElement(Group, { key: UNBOUND_SECTION_KEY, hasIcons: true, children });

	if (placeAfter(result, group, section) || wrapWithSection(group, section)) return children;

	return Array.isArray(group.props?.children) ? group.props.children : undefined;
}

export default sectionRows;
