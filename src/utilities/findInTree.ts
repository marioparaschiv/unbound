import type { FindInTreeOptions, FindInTreePredicate } from '@typings/utilities/findInTree';

/**
 * @description Traverses through a tree through provided walkables, aiming to find a specific item using a predicate.
 * @template T The type of the result you expect. Please keep in mind that the value might be null, wrapping your type in Nullable<T> is advised.
 * @param tree The tree to traverse.
 * @param predicate Predicate function to decide whether the current item in the search stack should be returned.
 * @param options The options for the search.
 * @param options.ignore The keys to ignore during traversal.
 * @param options.walkable The keys to walk/traverse in the search.
 * @param options.maxProperties The maximum properties to traverse through before bailing.
 * @return The value found by the predicate if one is found.
 */
function findInTree<T = any>(tree: Record<any, any> | unknown[], predicate: FindInTreePredicate, { ignore = [], walkable, maxProperties = 100 }: FindInTreeOptions): T {
	const stack: unknown[] = [tree];

	const filter = function (node: unknown) {
		try {
			return predicate.call(this, node);
		} catch {
			return false;
		}
	};

	while (stack.length && maxProperties) {
		const node = stack.shift();
		if (!node) continue;

		if (filter(node)) {
			return node as T;
		}

		if (Array.isArray(node)) {
			stack.push(...node);
		} else if (typeof node === 'object' && node !== null) {
			if (walkable.length) {
				for (const key in node) {
					const value = node[key];
					if (~walkable.indexOf(key) && !~ignore.indexOf(key)) {
						stack.push(value);
					}
				}
			} else {
				for (const key in node) {
					const value = node[key];
					if (node && ~ignore.indexOf(key)) continue;

					stack.push(value);
				}
			}
		}

		maxProperties--;
	}
};

export default findInTree;