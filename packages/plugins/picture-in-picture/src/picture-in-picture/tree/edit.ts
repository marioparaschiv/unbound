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

function collect(
	node: unknown,
	predicate: (element: TreeElement) => boolean,
	found: TreeElement[],
	depth: number,
) {
	if (depth > MAX_DEPTH) return;

	if (Array.isArray(node)) {
		for (const child of node) collect(child, predicate, found, depth + 1);

		return;
	}

	if (!isElement(node)) return;
	if (predicate(node)) found.push(node);

	collect(node.props?.children, predicate, found, depth + 1);
}

/**
 * @description Finds every element in a render result that matches, in tree order.
 * @param tree The render result.
 * @param predicate Decides whether an element matches.
 * @returns The matching elements.
 */
export function findElements(
	tree: unknown,
	predicate: (element: TreeElement) => boolean,
): TreeElement[] {
	const found: TreeElement[] = [];

	collect(tree, predicate, found, 0);

	return found;
}

/**
 * @description Returns a copy of a render result with the first matching element given extra props, cloning only the elements on its path.
 * @param tree The render result.
 * @param predicate Decides which element to change.
 * @param props Builds the props to set on it from the element.
 * @param clone Clones an element with changed props, such as React's `cloneElement`.
 * @returns The new render result, or the same one when nothing matches.
 */
export function withElementProps(
	tree: unknown,
	predicate: (element: TreeElement) => boolean,
	props: (element: TreeElement) => Record<string, unknown>,
	clone: CloneElement,
): unknown {
	const [target] = findElements(tree, predicate);

	if (!target) return tree;

	return replaceIn(tree, target, (element) => clone(element, props(element)), clone, 0);
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
	const rows = findElements(tree, (element) =>
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
