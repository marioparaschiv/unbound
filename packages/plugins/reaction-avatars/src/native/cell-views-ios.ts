import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

export type ReactionCellViews = {
	collection: NativeObjectHandle;
	layout: NativeObjectHandle;
	list: NativeObjectHandle;
	visibleCells: unknown;
};

/**
 * @description Finds a message cell's reaction list, its collection view and that collection's layout.
 * @param objc The Objective-C bridge.
 * @param cell The `DCDMessageTableViewCell`.
 * @returns The views, or `undefined` when the message shows no reactions.
 */
export async function readReactionCellViews(
	objc: NativeObjCBridge,
	cell: NativeObjectHandle,
): Promise<ReactionCellViews | undefined> {
	const [list] = await objc.findViews(cell, 'DCDReactionListView', {
		maxDepth: 8,
		maxVisited: 70,
		maxResults: 1,
		stopAtMatch: true,
	});

	if (!list) return;

	const [collection] = await objc.findViews(list, 'UICollectionView', {
		maxDepth: 3,
		maxVisited: 100,
		maxResults: 1,
		stopAtMatch: true,
	});

	if (!collection) return;

	const [layout, visibleCells] = await objc.batch([
		{ target: collection, selector: 'collectionViewLayout', args: [] },
		{ target: collection, selector: 'visibleCells', args: [] },
	]);

	if (!layout || typeof layout !== 'object') return;

	return { collection, layout: layout as NativeObjectHandle, list, visibleCells };
}
