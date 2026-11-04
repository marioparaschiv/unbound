import { createElement, forwardRef, Fragment, memo } from 'react';
import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';

import { filterComponents, filterInTree, findComponent, findInTree } from '~/utils/react';

type RowProps = { id: string; children?: ReactNode };

type IdProps = { id?: string };

// A fiber-shaped node: child and sibling point down and across, return and alternate point back.
type FiberNode = {
	tag?: number;
	memoizedProps: IdProps;
	return?: FiberNode;
	child?: FiberNode;
	sibling?: FiberNode;
	alternate?: FiberNode;
	stateNode?: ClassInstance;
};

type ClassInstance = { props: IdProps; _reactInternals: FiberNode };

function Row({ children }: RowProps): ReactNode {
	return children;
}

const MemoRow = memo(Row);
const NamedRow = forwardRef<unknown, RowProps>(function Named() {
	return null;
});

const tree = createElement(
	'View',
	null,
	createElement(Row, { id: 'a' }, createElement(MemoRow, { id: 'b' })),
	[createElement(NamedRow, { id: 'c', key: 'c' })],
	createElement(Fragment, null, createElement('Text', { id: 'd' })),
);

describe('findComponent', () => {
	test('finds an element by component name through memo and forwardRef', () => {
		expect(findComponent(tree, 'Row')?.props.id).toBe('a');
		expect(filterComponents(tree, 'Row').map((element) => element.props.id)).toEqual([
			'a',
			'b',
		]);
		expect(findComponent(tree, 'Named')?.props.id).toBe('c');
	});

	test('finds an element by host type or predicate', () => {
		expect(findComponent(tree, 'Text')?.props.id).toBe('d');
		expect(findComponent<IdProps>(tree, (element) => element.props.id === 'b')?.type).toBe(
			MemoRow,
		);
	});

	test('returns undefined when nothing matches', () => {
		expect(findComponent(tree, 'Missing')).toBeUndefined();
		expect(filterComponents(null, 'Row')).toEqual([]);
	});
});

describe('utils.react.findInTree', () => {
	function createFibers() {
		const root: FiberNode = { tag: 3, memoizedProps: { id: 'root' } };
		const first: FiberNode = { tag: 0, memoizedProps: { id: 'first' }, return: root };
		const second: FiberNode = { tag: 1, memoizedProps: { id: 'second' }, return: root };
		const instance: ClassInstance = { props: { id: 'instance' }, _reactInternals: second };

		root.child = first;
		first.sibling = second;
		second.stateNode = instance;
		first.alternate = { memoizedProps: { id: 'alternate' } };

		return { root, first, second, instance };
	}

	test('walks a fiber downward through child, sibling and stateNode', () => {
		const { root, instance } = createFibers();

		expect(findInTree(root, (node) => node.props?.id === 'instance')).toBe(instance);
		expect(
			filterInTree(root, (node) => typeof node.memoizedProps?.id === 'string').map(
				(fiber) => fiber.memoizedProps.id,
			),
		).toEqual(['root', 'first', 'second']);
	});

	test('skips return and alternate unless walkable opts in', () => {
		const { root, second } = createFibers();
		const isAlternate = (node: Partial<FiberNode>) => node.memoizedProps?.id === 'alternate';

		expect(findInTree(root, isAlternate)).toBeUndefined();
		expect(findInTree(root, isAlternate, { walkable: ['alternate'] })).toBeDefined();
		expect(findInTree(second, (node) => node === root)).toBeUndefined();
		expect(findInTree(second, (node) => node === root, { walkable: ['return'] })).toBe(root);
	});

	test("starts from a class instance's _reactInternals", () => {
		const { instance } = createFibers();

		expect(findInTree(instance._reactInternals, (node) => node.props?.id === 'instance')).toBe(
			instance,
		);
	});

	test('walks elements as well as fibers, and honours ignore', () => {
		expect(findInTree(tree, (node) => node.props?.id === 'b')?.type).toBe(MemoRow);
		expect(
			findInTree(tree, (node) => node.props?.id === 'b', { ignore: ['children'] }),
		).toBeUndefined();
	});
});
