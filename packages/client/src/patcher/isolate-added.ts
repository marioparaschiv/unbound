import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

import { withElementBoundary } from '~/patcher/element-boundary';

// Elements Discord's renders returned, by identity. Weak, so each dies with the render that made it.
const discord = new WeakSet<object>();

type Element = ReactElement<MetroExport>;

// Prop values are read as trees: only elements and arrays are inspected, anything else holds no element.
function holdsDiscord(node: ReactNode): boolean {
	if (Array.isArray(node)) {
		return node.some(holdsDiscord);
	}

	return isValidElement(node) && (discord.has(node) || propsHoldDiscord(node));
}

function propsHoldDiscord(element: Element): boolean {
	for (const key in element.props) {
		if (holdsDiscord(element.props[key])) {
			return true;
		}
	}

	return false;
}

// A sibling of Discord's with the same type is one of a list its parent may read, so it keeps its type.
function hasDiscordTwin(element: Element, siblings: readonly ReactNode[]): boolean {
	return siblings.some(
		(sibling) =>
			isValidElement(sibling) && discord.has(sibling) && sibling.type === element.type,
	);
}

// `node` fills a slot of an element on Discord's side: an added element there renders inside its own boundary.
function isolateSlot(
	node: ReactNode,
	component: string,
	siblings: readonly ReactNode[],
): ReactNode {
	if (Array.isArray(node)) {
		return isolateList(node, component);
	}

	if (!isValidElement<MetroExport>(node)) {
		return node;
	}

	if (holdsDiscord(node)) {
		return isolateElement(node, component);
	}

	return hasDiscordTwin(node, siblings) ? node : withElementBoundary(node, component);
}

// Copies the list only when one of its items changes.
function isolateList(items: readonly ReactNode[], component: string): readonly ReactNode[] {
	let copy: ReactNode[] | undefined;

	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		const next = isolateSlot(item, component, items);

		if (next !== item) {
			copy ??= [...items];
			copy[index] = next;
		}
	}

	return copy ?? items;
}

// Copies the element and its props only when one of its props changes.
function isolateElement(element: Element, component: string): Element {
	let props: Record<PropertyKey, unknown> | undefined;

	for (const key in element.props) {
		const value = element.props[key];
		const next = isolateSlot(value, component, []);

		if (next !== value) {
			props = { ...(props ?? element.props), [key]: next };
		}
	}

	return props ? { ...element, props } : element;
}

/**
 * @description Records the elements of a tree Discord rendered, before a patch can edit it in place.
 * @param node The tree Discord's component rendered.
 */
export function markDiscordTree(node: ReactNode): void {
	if (Array.isArray(node)) {
		for (const item of node) markDiscordTree(item);

		return;
	}

	// A marked element was walked already: Discord memoised it.
	if (!isValidElement(node) || discord.has(node)) return;

	markElement(node);
}

function markElement(element: Element): void {
	discord.add(element);

	for (const key in element.props) {
		const value = element.props[key];

		if (isValidElement(value) || Array.isArray(value)) {
			markDiscordTree(value);
		}
	}
}

/**
 * @description Wraps each element a patch added next to Discord's in a boundary that renders nothing while it
 * throws, so a crash leaves Discord's elements, and their fibers, in place. A tree holding none of Discord's
 * elements replaced it and comes back as it is.
 * @param node The patched tree.
 * @param component The patched component's name, for the log.
 * @returns The tree, copied along the paths to each wrapped element.
 */
export function isolateAdded(node: ReactNode, component: string): ReactNode {
	return holdsDiscord(node) ? isolateSlot(node, component, []) : node;
}
