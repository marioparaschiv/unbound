// UNKNOWN: a component may render any node.
type RenderFunction = (...args: never[]) => unknown;

type ComponentFunction = RenderFunction & {
	displayName?: string;
};

type ComponentObject = {
	displayName?: string;
	name?: string;
	type?: ComponentFunction;
	render?: ComponentFunction;
};

type ElementProps = {
	children?: unknown;
	hasIcons?: unknown;
	label?: unknown;
	onPress?: unknown;
};

export type ElementNode = {
	key?: unknown;
	type?: string | ComponentFunction | ComponentObject;
	props?: ElementProps;
};

const MAX_DEPTH = 15;

/**
 * @description Checks whether a value can be read as a rendered React element.
 * @param value Any node from a render result.
 * @returns `true` for any non-null object, including arrays of children.
 */
export function isElementNode(value: unknown): value is ElementNode {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Reads the component name of an element, looking through `memo` and `forwardRef` wrappers.
 * @param element The rendered element.
 * @returns The host tag, display name or function name, or `undefined` when the component is anonymous.
 */
export function getElementName(element: ElementNode): string | undefined {
	const { type } = element;

	if (typeof type === 'string') {
		return type;
	}

	if (typeof type === 'function') {
		return type.displayName ?? type.name;
	}

	return (
		type?.displayName ??
		type?.name ??
		type?.render?.displayName ??
		type?.render?.name ??
		type?.type?.displayName ??
		type?.type?.name
	);
}

/**
 * @description Searches a render result depth-first for the first element matching a predicate, through children only.
 * @param node A render result: an element, an array of children, or anything else React accepts.
 * @param predicate Decides whether an element is the one being searched for.
 * @param depth The current depth; the search stops past 15 levels.
 * @returns The matching element, or `undefined` when none matches.
 */
export function findElement(
	// UNKNOWN: a component may render any node, not only elements.
	node: unknown,
	predicate: (element: ElementNode) => boolean,
	depth: number = 0,
): ElementNode | undefined {
	if (depth > MAX_DEPTH || !isElementNode(node)) return;

	if (Array.isArray(node)) {
		for (const child of node) {
			const match = findElement(child, predicate, depth + 1);

			if (match) {
				return match;
			}
		}

		return;
	}

	if (predicate(node)) {
		return node;
	}

	return findElement(node.props?.children, predicate, depth + 1);
}

export default { isElementNode, getElementName, findElement };
