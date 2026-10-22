import { describe, expect, test } from 'bun:test';
import type { NativeObjectHandle } from '@unbound-app/api/native';

import { readReactionCellViews, type ReactionCellViewsBridge } from './reaction-cell-views';

describe('reaction cell view lookup', () => {
	test('finds the reaction collection and reads its layout in one batch', async () => {
		const cell = {} as NativeObjectHandle;
		const list = {} as NativeObjectHandle;
		const collection = {} as NativeObjectHandle;
		const layout = {} as NativeObjectHandle;
		const visibleCells = [{}];
		const searches: string[] = [];
		const bridge: ReactionCellViewsBridge = {
			findViews: async (root, className, options) => {
				searches.push(className);
				expect(options.stopAtMatch).toBe(true);
				if (root === cell && className === 'DCDReactionListView') return [list];
				if (root === list && className === 'UICollectionView') return [collection];
				return [];
			},
			batch: async (steps) => {
				expect(steps.map((step) => step.selector)).toEqual([
					'collectionViewLayout',
					'visibleCells',
				]);
				return [layout, visibleCells];
			},
		};

		expect(await readReactionCellViews(cell, bridge)).toEqual({
			collection,
			layout,
			list,
			visibleCells,
		});
		expect(searches).toEqual(['DCDReactionListView', 'UICollectionView']);
	});

	test('skips collection reads when the cell has no reaction list', async () => {
		const cell = {} as NativeObjectHandle;
		let batchCalls = 0;
		const bridge: ReactionCellViewsBridge = {
			findViews: async () => [],
			batch: async () => {
				batchCalls++;
				return [];
			},
		};

		expect(await readReactionCellViews(cell, bridge)).toBeUndefined();
		expect(batchCalls).toBe(0);
	});
});
