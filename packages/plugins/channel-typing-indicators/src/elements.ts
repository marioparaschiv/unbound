import { cloneElement, type ReactElement, type ReactNode } from 'react';

import { childrenOf, type RenderNode } from '~/row-layout';

type Child = RenderNode | ReactNode;

/**
 * @description Copies a rendered element with new children, leaving the original untouched.
 * @param parent The element to copy.
 * @param children The copy's children.
 * @returns The copy.
 */
export function withChildren(parent: RenderNode, children: Child[]): ReactElement {
	// Rendered nodes are real React elements; `RenderNode` only names the props the plugin reads.
	return cloneElement(parent as ReactElement, {}, children as ReactNode[]);
}

/**
 * @description Copies a rendered element with one of its children swapped out.
 * @param parent The element whose children hold `child`.
 * @param child The child to replace.
 * @param next The replacement.
 * @returns A copy of `parent` with `next` in place of `child`.
 */
export function replaceChild(parent: RenderNode, child: RenderNode, next: Child): ReactElement {
	const children = childrenOf(parent) ?? [];

	return withChildren(
		parent,
		children.map((node) => (node === child ? next : node)),
	);
}

export default { withChildren, replaceChild };
