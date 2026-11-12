import { utils } from '@unbound-app/api';

export type TreeElement = {
	type?: unknown;
	props?: Record<string, unknown> & { children?: unknown };
};

export type CloneElement = (element: TreeElement, props: Record<string, unknown>) => TreeElement;

const MAX_DEPTH = 24;

function isElement(node: unknown): node is TreeElement {
	return typeof node === 'object' && node !== null && !Array.isArray(node) && 'props' in node;
}

function childrenOf(element: TreeElement): unknown[] {
	const { children } = element.props ?? {};

	if (children === undefined || children === null) return [];

	return Array.isArray(children) ? children : [children];
}

function replaceIn(
	node: unknown,
	target: TreeElement,
	update: (element: TreeElement) => TreeElement,
	clone: CloneElement,
	depth: number,
): unknown {
	if (depth > MAX_DEPTH) return node;

	if (Array.isArray(node)) {
		let changed = false;
		const next = node.map((child) => {
			const replaced = replaceIn(child, target, update, clone, depth + 1);

			if (replaced !== child) changed = true;

			return replaced;
		});

		return changed ? next : node;
	}

	if (!isElement(node)) return node;
	if (node === target) return update(node);

	const children = node.props?.children;
	const replaced = replaceIn(children, target, update, clone, depth + 1);

	return replaced === children ? node : clone(node, { children: replaced });
}

/**
 * @description Returns a copy of a render result with an element added to the last row of buttons, just before that row's last button.
 * @param tree The render result.
 * @param isButton Decides whether an element is one of the row's buttons.
 * @param addition The element to add.
 * @param clone Clones an element with changed props, such as React's `cloneElement`.
 * @returns The new render result, or `undefined` when no element holds a button.
 */
export function insertBeforeLastButton(
	tree: unknown,
	isButton: (element: TreeElement) => boolean,
	addition: unknown,
	clone: CloneElement,
): unknown {
	const rows = utils.react.filterComponents(tree, (element) =>
		childrenOf(element).some((child) => isElement(child) && isButton(child)),
	);
	const row = rows.at(-1);

	if (!row) return;

	return replaceIn(
		tree,
		row,
		(element) => {
			const children = childrenOf(element);
			const last = children.findLastIndex((child) => isElement(child) && isButton(child));

			return clone(element, {
				children: [...children.slice(0, last), addition, ...children.slice(last)],
			});
		},
		clone,
		0,
	);
}
