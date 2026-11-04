import type { TreeNode, TreePredicate, TreeSearchOptions } from '@unbound-app/utils/walk-tree';
import baseFilterInTree from '@unbound-app/utils/filter-in-tree';
import baseFindInTree from '@unbound-app/utils/find-in-tree';

/**
 * The keys a React search descends into on elements and fibers. `return` and `alternate` point back up or across,
 * so they are left out and the search only goes down.
 */
const REACT_KEYS = [
	'props',
	'children',
	'type',
	'child',
	'sibling',
	'memoizedProps',
	'memoizedState',
	'stateNode',
];

function reactOptions({ walkable = [], ...rest }: TreeSearchOptions): TreeSearchOptions {
	return { ...rest, walkable: [...REACT_KEYS, ...walkable] };
}

/**
 * @description Finds the first node in a React element or fiber tree a predicate matches, searching only downward.
 * Start from an element, a fiber, or a class instance's `_reactInternals`.
 * @template T The matched node's type.
 * @param root The element or fiber to start from; it is tested too.
 * @param predicate Tests each non-nullish node.
 * @param options `walkable` adds keys to the React ones (such as `return`), `ignore` skips keys, `maxDepth` defaults to 100.
 * @returns The first match, or `undefined` when none matches.
 */
export function findInTree<T = TreeNode>(
	root: TreeNode,
	predicate: TreePredicate,
	options: TreeSearchOptions = {},
): T | undefined {
	return baseFindInTree<T>(root, predicate, reactOptions(options));
}

/**
 * @description Finds every node in a React element or fiber tree a predicate matches, searching only downward.
 * Start from an element, a fiber, or a class instance's `_reactInternals`.
 * @template T The matched nodes' type.
 * @param root The element or fiber to start from; it is tested too.
 * @param predicate Tests each non-nullish node.
 * @param options `walkable` adds keys to the React ones (such as `return`), `ignore` skips keys, `maxDepth` defaults to 100.
 * @returns Every match, in visiting order.
 */
export function filterInTree<T = TreeNode>(
	root: TreeNode,
	predicate: TreePredicate,
	options: TreeSearchOptions = {},
): T[] {
	return baseFilterInTree<T>(root, predicate, reactOptions(options));
}
