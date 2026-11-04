export type TreeNode = {
	props?: { label?: unknown; children?: unknown } & Record<string, unknown>;
};

export type CloneNode = (node: TreeNode, props: Record<string, unknown>) => unknown;

const MAX_DEPTH = 8;

function isNode(value: unknown): value is TreeNode {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rewriteChildren(
	children: unknown,
	rewrite: (child: unknown) => unknown,
): { children: unknown; changed: boolean } {
	if (!Array.isArray(children)) {
		const next = rewrite(children);

		return next === undefined
			? { children, changed: false }
			: { children: next, changed: true };
	}

	let changed = false;
	const next = children.map((child) => {
		if (changed) return child;

		const rewritten = rewrite(child);

		if (rewritten === undefined) return child;

		changed = true;

		return rewritten;
	});

	return { children: changed ? next : children, changed };
}

/**
 * @description Rebuilds a render result with something added after the first `label` prop it holds, such as a `TableRow`'s label.
 * @param node The render result.
 * @param suffix What to add after the label.
 * @param clone Copies an element with changed props, React's `cloneElement`.
 * @param depth The current depth; the search stops past 8 levels.
 * @returns The rebuilt result, or `undefined` when no element in it has a label.
 */
export function appendToLabel(
	node: unknown,
	suffix: unknown,
	clone: CloneNode,
	depth: number = 0,
): unknown {
	if (depth > MAX_DEPTH || !isNode(node) || !node.props) return;

	if (node.props.label != null) {
		return clone(node, { label: [node.props.label, suffix] });
	}

	const { children, changed } = rewriteChildren(node.props.children, (child) =>
		appendToLabel(child, suffix, clone, depth + 1),
	);

	return changed ? clone(node, { children }) : undefined;
}
