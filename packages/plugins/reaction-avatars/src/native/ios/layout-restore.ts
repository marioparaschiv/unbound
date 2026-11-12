import type { NativeObjectHandle } from '@unbound-app/api/native';
import { parseRect, parseSize } from '@unbound-plugins/shared/native/ios/rect';
import { safeInvoke } from '@unbound-plugins/shared/native/ios/safe-invoke';

import {
	frameOf,
	itemOfCell,
	key,
	restoreFrame,
	setContentSize,
	setFrame,
	toHandles,
} from '~/native/ios/views';
import { markTableDirty, scheduleTableLayout } from '~/native/ios/tables';
import { clearCellHeight } from '~/native/ios/cell-heights';
import { bottomOf } from '~/lib/layout';

import type { LayoutEntry } from '~/native/ios/collections';
import type { Session } from '~/native/ios/session';

declare global {
	var __unboundReactionAvatarsLayoutEpochs: Map<string, number> | undefined;
}

const layoutEpochs = (globalThis.__unboundReactionAvatarsLayoutEpochs ??= new Map());

/**
 * @description Grows the views between a reaction collection and its message cell by `delta` over their original heights.
 * @param session The running session.
 * @param entry The collection's layout.
 * @param delta How much taller each view gets, `0` for its original height.
 */
export function setAncestorFrames(session: Session, entry: LayoutEntry, delta: number): void {
	for (const { frame, view } of entry.ancestorFrames) {
		setFrame(session.objc, view, { ...frame, height: frame.height + delta });
	}
}

function restoreAncestorFrames(session: Session, entry: LayoutEntry): void {
	for (const { frame, view } of entry.ancestorFrames) {
		if (session.disposing) setFrame(session.objc, view, frame);
		else restoreFrame(session.objc, view, frame);
	}
}

function restoreLayoutNow(
	session: Session,
	entry: LayoutEntry,
	baseHeight: number | undefined,
): void {
	const { objc } = session;

	for (const cell of toHandles(objc, safeInvoke(objc, entry.collection, 'visibleCells'))) {
		const index = itemOfCell(objc, entry.collection, cell);
		const frame = index === undefined ? undefined : entry.baseItems.get(index);

		if (frame) setFrame(objc, cell, frame);
	}

	if (baseHeight === undefined) return;

	const size = parseSize(safeInvoke(objc, entry.collection, 'contentSize'));
	const frame = frameOf(objc, entry.collection);

	setContentSize(objc, entry.collection, {
		height: baseHeight,
		width: size?.width ?? frame?.width ?? 0,
	});

	if (frame) setFrame(objc, entry.collection, { ...frame, height: baseHeight });
}

function layoutEpoch(session: Session, entry: LayoutEntry): number {
	return layoutEpochs.get(key(session.objc, entry.collection)) ?? 0;
}

/**
 * @description Starts a new layout epoch for a collection, so restores still in flight from an older one stop.
 * @param session The running session.
 * @param entry The collection's layout.
 */
export function advanceLayoutEpoch(session: Session, entry: LayoutEntry): void {
	const collectionKey = key(session.objc, entry.collection);

	layoutEpochs.set(collectionKey, (layoutEpochs.get(collectionKey) ?? 0) + 1);
}

function restoreVisibleCell(
	session: Session,
	entry: LayoutEntry,
	cell: NativeObjectHandle,
	epoch: number,
): void {
	const { objc } = session;
	const baseItems = new Map(entry.baseItems);

	void objc
		.batch([
			{ target: entry.collection, selector: 'indexPathForCell:', args: [cell] },
			{ target: { $nativeBatchResult: 0 }, selector: 'item', args: [] },
		])
		.then(([, item]) => {
			const frame = baseItems.get(Math.floor(Number(item)));

			if (frame && layoutEpoch(session, entry) === epoch) restoreFrame(objc, cell, frame);
		})
		.catch(() => undefined);
}

function restoreVisibleCells(session: Session, entry: LayoutEntry, epoch: number): void {
	const { objc } = session;

	void objc
		.invokeAsync(entry.collection, 'visibleCells', [])
		.then((cells) => {
			if (layoutEpoch(session, entry) !== epoch) return;

			for (const cell of toHandles(objc, cells))
				restoreVisibleCell(session, entry, cell, epoch);
		})
		.catch(() => undefined);
}

function restoreCollectionHeight(
	session: Session,
	entry: LayoutEntry,
	baseHeight: number,
	epoch: number,
): void {
	const { objc } = session;
	const { collection } = entry;

	void objc
		.batch([
			{ target: collection, selector: 'contentSize', args: [] },
			{ target: collection, selector: 'frame', args: [] },
		])
		.then(([size, rect]) => {
			if (layoutEpoch(session, entry) !== epoch) return;

			const frame = parseRect(rect);
			const width = parseSize(size)?.width ?? frame?.width ?? 0;

			void objc
				.invokeAsync(collection, 'setContentSize:', [
					objc.struct('CGSize', { height: baseHeight, width }),
				])
				.catch(() => undefined);

			if (frame) restoreFrame(objc, collection, { ...frame, height: baseHeight });
		})
		.catch(() => undefined);
}

/**
 * @description Puts a reaction collection back as Discord laid it out: its pills, its height, its ancestors and its cell's height.
 * @param session The running session.
 * @param entry The collection's layout.
 */
export function restoreLayout(session: Session, entry: LayoutEntry): void {
	clearCellHeight(session, entry);
	restoreAncestorFrames(session, entry);

	const baseItems = [...entry.baseItems.values()];
	const baseHeight = baseItems.length ? bottomOf(baseItems) : entry.plan?.baseHeight;

	if (session.disposing) {
		restoreLayoutNow(session, entry, baseHeight);
	} else {
		const epoch = layoutEpoch(session, entry);

		restoreVisibleCells(session, entry, epoch);

		if (baseHeight !== undefined) restoreCollectionHeight(session, entry, baseHeight, epoch);
	}

	const table = markTableDirty(session, entry.ownerTableKey);

	if (table) scheduleTableLayout(session, table);
}

export default { advanceLayoutEpoch, restoreLayout, setAncestorFrames };
