import type { TreeNode, TreeSearchOptions } from '@unbound-app/utils/walk-tree';
import filterInTree from '@unbound-app/utils/filter-in-tree';
import type { PredicateResult } from '@unbound-app/types';
import findInTree from '@unbound-app/utils/find-in-tree';
import type { ReactElement } from 'react';

/**
 * Picks an element: a component name, matched against its `displayName` or `name` through `memo` and `forwardRef`
 * wrappers (or a host type such as `RCTView`), or a predicate on the element.
 * @template P The element's props.
 */
export type ComponentMatch<P = TreeNode> = string | ((element: ReactElement<P>) => PredicateResult);

const ELEMENT_TYPES = new Set([
	Symbol.for('react.transitional.element'),
	Symbol.for('react.element'),
]);
const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

// Elements nest through their props, so only `props` and `children` lead to more elements.
const ELEMENT_OPTIONS: TreeSearchOptions = { walkable: ['props', 'children'] };

function isElement(node: TreeNode): node is ReactElement<TreeNode> {
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

function elementPredicate<P>(match: ComponentMatch<P>) {
	return (node: TreeNode) =>
		isElement(node) && (typeof match === 'string' ? isNamed(node.type, match) : match(node));
}

/**
 * @description Finds the first element in a rendered tree that a component name or predicate picks, walking only `props` and `children`.
 * @template P The element's props.
 * @param tree A render result, such as `result` in an `after` patch.
 * @param match A component name, or a predicate on each element.
 * @returns The first matching element, or `undefined` when none matches.
 */
export function findComponent<P = TreeNode>(
	tree: TreeNode,
	match: ComponentMatch<P>,
): ReactElement<P> | undefined {
	return findInTree<ReactElement<P>>(tree, elementPredicate(match), ELEMENT_OPTIONS);
}

/**
 * @description Finds every element in a rendered tree that a component name or predicate picks, walking only `props` and `children`.
 * @template P The elements' props.
 * @param tree A render result, such as `result` in an `after` patch.
 * @param match A component name, or a predicate on each element.
 * @returns Every matching element, outermost first.
 */
export function filterComponents<P = TreeNode>(
	tree: TreeNode,
	match: ComponentMatch<P>,
): ReactElement<P>[] {
	return filterInTree<ReactElement<P>>(tree, elementPredicate(match), ELEMENT_OPTIONS);
}
