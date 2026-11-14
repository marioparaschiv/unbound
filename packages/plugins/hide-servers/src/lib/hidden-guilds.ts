export type GuildBarNode = {
	type: string;
	id: unknown;
	children?: GuildBarNode[];
};

function isHiddenGuild(node: GuildBarNode, hidden: ReadonlySet<string>): boolean {
	return node.type === 'guild' && hidden.has(String(node.id));
}

function withoutHiddenChildren<T extends GuildBarNode>(
	node: T,
	hidden: ReadonlySet<string>,
): T | undefined {
	if (!node.children) return node;

	const children = node.children.filter((child) => !isHiddenGuild(child, hidden));

	if (children.length === node.children.length) return node;
	if (!children.length) return undefined;

	return { ...node, children };
}

/**
 * @description Leaves hidden servers out of the server list, and folders that only held hidden servers.
 * @template T A node of the server list.
 * @param nodes The server list's top-level servers and folders.
 * @param hidden The ids of the hidden servers.
 * @returns The list without them, or `nodes` itself when nothing is hidden there.
 */
export function withoutHiddenGuilds<T extends GuildBarNode>(
	nodes: readonly T[],
	hidden: ReadonlySet<string>,
): readonly T[] {
	if (!hidden.size) return nodes;

	let changed = false;
	const kept: T[] = [];

	for (const node of nodes) {
		const next = isHiddenGuild(node, hidden) ? undefined : withoutHiddenChildren(node, hidden);

		if (next !== node) changed = true;
		if (next) kept.push(next);
	}

	return changed ? kept : nodes;
}

export type GuildsTree = {
	root: GuildBarNode;
	nodes: Record<string, GuildBarNode>;
	version?: unknown;
};

function indexNodes(nodes: readonly GuildBarNode[], index: Record<string, GuildBarNode> = {}) {
	for (const node of nodes) {
		index[String(node.id)] = node;

		if (node.children) indexNodes(node.children, index);
	}

	return index;
}

/**
 * @description Leaves hidden servers out of Discord's server tree, keeping its methods.
 * @template T The tree.
 * @param tree `SortedGuildStore.getGuildsTree()`.
 * @param hidden The ids of the hidden servers.
 * @returns A copy of the tree without them under its own version, so the server bar redraws; `tree` itself when nothing is hidden there.
 */
export function treeWithoutHiddenGuilds<T extends GuildsTree>(
	tree: T,
	hidden: ReadonlySet<string>,
): T {
	const roots = tree.root.children ?? [];
	const children = withoutHiddenGuilds(roots, hidden);

	if (children === roots) return tree;

	const copy: T = Object.create(Object.getPrototypeOf(tree));

	return Object.assign(copy, tree, {
		root: { ...tree.root, children },
		nodes: indexNodes(children),
		version: `${String(tree.version)}:${[...hidden].join(',')}`,
	});
}

export default withoutHiddenGuilds;
