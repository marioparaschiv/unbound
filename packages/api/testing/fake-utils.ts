import { useRef } from 'react';

import type { TreeNode, TreePredicate, TreeSearchOptions } from '../src/utils/index';
import type { PredicateResult } from '../src/_types';

import walkTree from '../src/_conventions/walk-tree';

// The tree walk is the client's own; the React finders below mirror the client's `utils/react`.

/** What `findComponent` and `filterComponents` match by: a component name, or a predicate on each element. */
type ComponentMatch = string | ((element: TreeNode) => PredicateResult);

const ELEMENT_TYPES = new Set([
	Symbol.for('react.transitional.element'),
	Symbol.for('react.element'),
]);
const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');
// The keys a React search descends into; `return` and `alternate` point back up, so it only goes down.
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
// Elements nest through their props, so only `props` and `children` lead to more elements.
const ELEMENT_OPTIONS: TreeSearchOptions = { walkable: ['props', 'children'] };

function reactOptions({ walkable = [], ...rest }: TreeSearchOptions): TreeSearchOptions {
	return { ...rest, walkable: [...REACT_KEYS, ...walkable] };
}

function isElement(node: TreeNode): boolean {
	return typeof node === 'object' && ELEMENT_TYPES.has(node.$$typeof);
}

function isNamed(type: TreeNode, name: string): boolean {
	if (typeof type === 'string') {
		return type === name;
	}

	if (!type) {
		return false;
	}

	if (type.displayName === name) {
		return true;
	}

	if (type.$$typeof === MEMO) {
		return isNamed(type.type, name);
	}

	if (type.$$typeof === FORWARD_REF) {
		return isNamed(type.render, name);
	}

	return typeof type === 'function' && type.name === name;
}

function elementPredicate(match: ComponentMatch): TreePredicate {
	return (node) =>
		isElement(node) && (typeof match === 'string' ? isNamed(node.type, match) : match(node));
}

function sameEntries(left: Iterable<[unknown, unknown]>, right: Map<unknown, unknown>): boolean {
	return [...left].every(([key, value]) => right.has(key) && Object.is(value, right.get(key)));
}

function shallow<T>(previous: T, next: T): boolean {
	if (Object.is(previous, next)) {
		return true;
	}

	if (
		typeof previous !== 'object' ||
		previous === null ||
		typeof next !== 'object' ||
		next === null
	) {
		return false;
	}

	if (previous instanceof Map && next instanceof Map) {
		return previous.size === next.size && sameEntries(previous, next);
	}

	if (previous instanceof Set && next instanceof Set) {
		return previous.size === next.size && [...previous].every((item) => next.has(item));
	}

	const left = Object.entries(previous);

	return (
		left.length === Object.keys(next).length && sameEntries(left, new Map(Object.entries(next)))
	);
}

function useShallow<S, U>(selector: (state: S) => U): (state: S) => U {
	const previous = useRef<U | undefined>(undefined);

	return (state) => {
		const next = selector(state);

		if (previous.current !== undefined && shallow(previous.current, next)) {
			return previous.current;
		}

		previous.current = next;

		return next;
	};
}

function findInTree<T = TreeNode>(
	root: TreeNode,
	predicate: TreePredicate,
	options: TreeSearchOptions = {},
): T | undefined {
	return walkTree(root, predicate, options, false)[0];
}

function filterInTree<T = TreeNode>(
	root: TreeNode,
	predicate: TreePredicate,
	options: TreeSearchOptions = {},
): T[] {
	return walkTree(root, predicate, options, true);
}

/**
 * @description Creates the fake `utils`: the client's tree searches, component finders and shallow comparison, over any object graph.
 * @returns The namespace, with `react` nested as on device.
 */
export function createFakeUtils() {
	const react = {
		findComponent: (tree: TreeNode, match: ComponentMatch) =>
			findInTree(tree, elementPredicate(match), ELEMENT_OPTIONS),
		filterComponents: (tree: TreeNode, match: ComponentMatch) =>
			filterInTree(tree, elementPredicate(match), ELEMENT_OPTIONS),
		findInTree: <T = TreeNode>(
			root: TreeNode,
			predicate: TreePredicate,
			options?: TreeSearchOptions,
		) => findInTree<T>(root, predicate, reactOptions(options ?? {})),
		filterInTree: <T = TreeNode>(
			root: TreeNode,
			predicate: TreePredicate,
			options?: TreeSearchOptions,
		) => filterInTree<T>(root, predicate, reactOptions(options ?? {})),
		shallow,
		useShallow,
	};

	return { findInTree, filterInTree, react };
}
