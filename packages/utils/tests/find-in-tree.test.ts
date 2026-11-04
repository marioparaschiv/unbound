import { describe, expect, test } from 'bun:test';

import filterInTree from '~/filter-in-tree';
import findInTree from '~/find-in-tree';

const tree = {
	id: 'root',
	left: { id: 'a', items: [{ id: 'b' }, { id: 'c', hidden: { id: 'd' } }] },
	right: { id: 'e' },
};

describe('findInTree', () => {
	test('returns the first match depth-first, testing the root too', () => {
		expect(findInTree(tree, (node) => node.id === 'root')).toBe(tree);
		expect(findInTree(tree, (node) => node.id === 'c')).toBe(tree.left.items[1]);
	});

	test('returns undefined when nothing matches', () => {
		expect(findInTree(tree, (node) => node.id === 'missing')).toBeUndefined();
		expect(findInTree(null, () => true)).toBeUndefined();
	});

	test('survives cycles', () => {
		const cyclic: { id: string; self?: object; next: { back?: object } } = {
			id: 'x',
			next: {},
		};

		cyclic.self = cyclic;
		cyclic.next.back = cyclic;

		expect(findInTree(cyclic, (node) => node.id === 'y')).toBeUndefined();
	});

	test('descends only into walkable keys, and always into arrays', () => {
		expect(findInTree(tree, (node) => node.id === 'e', { walkable: ['left'] })).toBeUndefined();
		expect(findInTree(tree, (node) => node.id === 'b', { walkable: ['left', 'items'] })).toBe(
			tree.left.items[0],
		);
	});

	test('skips ignored keys', () => {
		expect(findInTree(tree, (node) => node.id === 'd', { ignore: ['hidden'] })).toBeUndefined();
	});

	test('stops at maxDepth', () => {
		// root -> left -> items -> [1] -> hidden puts `d` four levels down.
		expect(findInTree(tree, (node) => node.id === 'd', { maxDepth: 3 })).toBeUndefined();
		expect(findInTree(tree, (node) => node.id === 'd', { maxDepth: 4 })).toBe(
			tree.left.items[1].hidden,
		);
	});
});

type Identified = { id: string };

describe('filterInTree', () => {
	test('returns every match in visiting order', () => {
		const ids = filterInTree<Identified>(tree, (node) => typeof node.id === 'string').map(
			(node) => node.id,
		);

		expect(ids).toEqual(['root', 'a', 'b', 'c', 'd', 'e']);
	});

	test('returns each shared node once', () => {
		const shared = { id: 'shared' };

		expect(filterInTree({ a: shared, b: [shared] }, (node) => node.id === 'shared')).toEqual([
			shared,
		]);
	});
});
