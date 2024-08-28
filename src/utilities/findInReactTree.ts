import type { FindInTreeOptions, FindInTreePredicate } from '@typings/utilities/findInTree';
import findInTree from '@utilities/findInTree';

/**
 * @description Traverses through a React node to find a specific item using a predicate, useful for searching children in node trees that might change as Discord gets updated.
 * @template T The type of the result you expect. Please keep in mind that the value might be null, wrapping your type in Nullable<T> is advised.
 * @param tree The React node to search through.
 * @param predicate Predicate function to decide whether the current item in the search stack should be returned.
 * @param options Search options for findInTree, see https://github.com/unbound-mod/client/blob/main/src/utilities/findInTree.ts for more information.
 * @return The value found by the predicate if one is found.
 */
function findInReactTree<T = any>(tree: JSX.Element, predicate: FindInTreePredicate, options: Partial<FindInTreeOptions> = {}) {
	return findInTree<T>(tree, predicate, { walkable: ['props', 'children'], ...options });
};

export default findInReactTree;