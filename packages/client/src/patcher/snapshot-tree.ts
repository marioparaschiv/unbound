import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';

// UNKNOWN: any prop value may hold elements; only elements and arrays are inspected.
function holdsElements(value: unknown[]): boolean {
	return value.some((item) => isValidElement(item) || Array.isArray(item));
}

// Discord's elements carry whatever props its components take.
function snapshotElement(element: ReactElement<MetroExport>): ReactElement {
	const props: MetroExport = { ...element.props };

	for (const key in props) {
		const value = props[key];

		if (isValidElement(value) || (Array.isArray(value) && holdsElements(value))) {
			props[key] = snapshotTree(value);
		}
	}

	return { ...element, props };
}

/**
 * @description Copies the elements of a rendered tree, so a patch that edits the tree in place leaves the copy intact.
 * Only elements and arrays holding them are copied; other prop values are shared.
 * @param node The tree a component rendered.
 * @returns A copy with fresh elements, props objects and children arrays.
 */
export function snapshotTree(node: ReactNode): ReactNode {
	if (Array.isArray(node)) {
		return node.map(snapshotTree);
	}

	if (!isValidElement<MetroExport>(node)) {
		return node;
	}

	return snapshotElement(node);
}
