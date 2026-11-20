import { describe, expect, test } from 'bun:test';

import { folderState, treeWithoutHiddenGuilds, withoutHiddenGuilds } from '~/lib/hidden-guilds';

const guild = (id: string) => ({ type: 'guild', id });
const folder = (id: number, ...children: ReturnType<typeof guild>[]) => ({
	type: 'folder',
	id,
	children,
});

describe('hidden guilds', () => {
	test('keeps the same list when nothing is hidden there', () => {
		const nodes = [guild('1'), folder(5, guild('2'))];

		expect(withoutHiddenGuilds(nodes, new Set())).toBe(nodes);
		expect(withoutHiddenGuilds(nodes, new Set(['9']))).toBe(nodes);
	});

	test('drops hidden servers at the top and inside folders', () => {
		const kept = folder(5, guild('3'));
		const nodes = [guild('1'), folder(5, guild('2'), guild('3')), folder(6, guild('4'))];

		expect(withoutHiddenGuilds(nodes, new Set(['1', '2']))).toEqual([
			kept,
			folder(6, guild('4')),
		]);
	});

	test('drops folders that only held hidden servers', () => {
		expect(withoutHiddenGuilds([folder(5, guild('2'))], new Set(['2']))).toEqual([]);
	});
});

describe('hidden guilds in the tree', () => {
	class Tree {
		root: { type: string; id: unknown; children: ReturnType<typeof guild>[] };
		nodes: Record<string, ReturnType<typeof guild>>;
		version = 3;

		constructor(children: ReturnType<typeof guild>[]) {
			this.root = { type: 'root', id: undefined, children };
			this.nodes = Object.fromEntries(children.map((child) => [child.id, child]));
		}

		size() {
			return this.root.children.length;
		}
	}

	test('copies the tree without hidden servers and keeps its methods', () => {
		const tree = new Tree([guild('1'), guild('2')]);
		const filtered = treeWithoutHiddenGuilds(tree, new Set(['1']));

		expect(filtered.size()).toBe(1);
		expect(Object.keys(filtered.nodes)).toEqual(['2']);
		expect(tree.size()).toBe(2);
		expect(filtered.version).not.toBe(tree.version);
	});

	test('keeps the same tree when nothing is hidden there', () => {
		const tree = new Tree([guild('1')]);

		expect(treeWithoutHiddenGuilds(tree, new Set(['9']))).toBe(tree);
	});
});

describe('folderState', () => {
	test('names the open folders, so a toggled folder is seen as a change', () => {
		const tree = {
			root: {
				type: 'root',
				id: 'root',
				children: [
					{ type: 'folder', id: 1, expanded: true, children: [] },
					{ type: 'folder', id: 2, expanded: false, children: [] },
					{ type: 'guild', id: '3' },
				],
			},
			nodes: {},
		};

		expect(folderState(tree)).toBe('1');
	});
});
