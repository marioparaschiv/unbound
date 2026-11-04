import type { TreeNode, TreePredicate, TreeSearchOptions } from './walk-tree';

import walkTree from './walk-tree';

/**
 * @description Finds the first node in an object graph a predicate matches, depth-first from the root. Cycle-safe.
 * @template T The matched node's type.
 * @param root The node to start from; it is tested too.
 * @param predicate Tests each non-nullish node.
 * @param options Which keys to descend into or skip, and how deep.
 * @returns The first match, or `undefined` when none matches.
 */
function findInTree<T = TreeNode>(
	root: TreeNode,
	predicate: TreePredicate,
	options: TreeSearchOptions = {},
): T | undefined {
	return walkTree(root, predicate, options, false)[0];
}

export default findInTree;
