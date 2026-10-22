import type {
	NativeBatchStep,
	NativeObjectHandle,
	NativeViewSearchOptions,
} from '@unbound-app/api/native';

export type ReactionCellViews = {
	collection: NativeObjectHandle;
	layout: NativeObjectHandle;
	list: NativeObjectHandle;
	visibleCells: unknown;
};

export interface ReactionCellViewsBridge {
	batch(steps: readonly NativeBatchStep[]): Promise<unknown[]>;
	findViews(
		root: NativeObjectHandle,
		className: string,
		options: NativeViewSearchOptions,
	): Promise<NativeObjectHandle[]>;
}

export async function readReactionCellViews(
	cell: NativeObjectHandle,
	bridge: ReactionCellViewsBridge,
): Promise<ReactionCellViews | undefined> {
	const lists = await bridge.findViews(cell, 'DCDReactionListView', {
		maxDepth: 8,
		maxVisited: 70,
		maxResults: 1,
		stopAtMatch: true,
	});
	const list = lists[0];
	if (!list) return;
	const collections = await bridge.findViews(list, 'UICollectionView', {
		maxDepth: 3,
		maxVisited: 100,
		maxResults: 1,
		stopAtMatch: true,
	});
	const collection = collections[0];
	if (!collection) return;
	const [layout, visibleCells] = await bridge.batch([
		{ target: collection, selector: 'collectionViewLayout', args: [] },
		{ target: collection, selector: 'visibleCells', args: [] },
	]);
	if (!layout || typeof layout !== 'object') return;
	return { collection, layout: layout as NativeObjectHandle, list, visibleCells };
}
