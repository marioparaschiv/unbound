import type { NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import {
	ancestorOfClass,
	frameOf,
	itemCount,
	itemOfCell,
	key,
	reactionViewOf,
	readRect,
	readSize,
	sectionCount,
	sectionItemCount,
	setContentSize,
	setFrame,
	toHandles,
} from '~/native/views';
import {
	flushTableLayout,
	hookTableLayout,
	markTableDirty,
	restoreTables,
	scheduleTableLayout,
	tableLayout,
} from '~/native/tables';
import {
	framesMatch,
	reflowReactionItems,
	type Frame,
	type LayoutFrame,
	type LayoutItem,
} from '~/layout';
import { clearCellHeight, clearCellHeights, updateCellHeight } from '~/native/cell-heights';
import { fitReactionView, releaseStates } from '~/native/reaction-views';
import { messageKey } from '~/reaction-context';
import { scheduleCell } from '~/native/cell-queue';
import type { Session } from '~/native/session';
import { NativeClass } from '~/constants';

type ViewFrame = {
	frame: Frame;
	view: NativeObjectHandle;
};

type AppliedCell = {
	index: number;
	revision: number;
};

type LayoutPlan = {
	baseHeight: number;
	frames: Map<number, LayoutFrame>;
	height: number;
	revision: number;
	width: number;
};

// One message's reaction collection view, reflowed so its widened pills do not overlap.
export type LayoutEntry = {
	// The views between the collection and the message cell, with their original frames.
	ancestorFrames: ViewFrame[];
	appliedCells: Map<string, AppliedCell>;
	appliedRevision: number;
	appliedWidth: number;
	// Each pill's frame as Discord laid it out.
	baseItems: Map<number, LayoutItem>;
	collection: NativeObjectHandle;
	extraWidths: Map<number, number>;
	invalidationScheduled: boolean;
	itemCount: number;
	layout: NativeObjectHandle;
	list: NativeObjectHandle;
	ownerCell: NativeObjectHandle | null;
	ownerCellKey: string;
	ownerMessageKey: string;
	ownerTableKey: string;
	plan: LayoutPlan | null;
	// Bumped whenever the base frames or extra widths change, so the plan is rebuilt.
	revision: number;
};

function captureAncestorFrames(session: Session, list: NativeObjectHandle): ViewFrame[] {
	const { objc } = session;
	const frames: ViewFrame[] = [];

	let current: NativeObjectHandle | null = list;

	while (current && frames.length < 8) {
		const className = objc.className(current) ?? '';

		if (className.includes(NativeClass.messageCell) || className.includes(NativeClass.table)) {
			break;
		}

		const frame = frameOf(objc, current);

		if (frame) frames.push({ frame, view: current });

		if (className.includes('UITableViewCellContentView')) break;

		current = safeInvoke(objc, current, 'superview') as NativeObjectHandle | null;
	}

	return frames;
}

function markChanged(session: Session, entry: LayoutEntry): void {
	entry.appliedCells.clear();
	entry.plan = null;
	entry.revision++;
	markTableDirty(session, entry.ownerTableKey);
}

function setAncestorFrames(session: Session, entry: LayoutEntry, delta: number): void {
	for (const { frame, view } of entry.ancestorFrames) {
		setFrame(session.objc, view, { ...frame, height: frame.height + delta });
	}
}

function planLayout(session: Session, entry: LayoutEntry): LayoutPlan | undefined {
	const width = readRect(safeInvoke(session.objc, entry.collection, 'bounds'))?.width;

	if (width === undefined || width <= 0 || entry.baseItems.size < entry.itemCount) return;

	if (entry.plan?.revision === entry.revision && entry.plan.width === width) return entry.plan;

	const items = [...entry.baseItems.values()].map((item) => ({
		...item,
		extraWidth: entry.extraWidths.get(item.index) ?? 0,
	}));
	const frames = reflowReactionItems(items, width);

	if (frames.length === 0) return;

	entry.plan = {
		baseHeight: Math.max(...items.map((item) => item.y + item.height)),
		frames: new Map(frames.map((frame) => [frame.index, frame])),
		height: Math.max(...frames.map((frame) => frame.y + frame.height)),
		revision: entry.revision,
		width,
	};

	return entry.plan;
}

function restoreLayout(session: Session, entry: LayoutEntry): void {
	const { objc } = session;

	clearCellHeight(session, entry);
	setAncestorFrames(session, entry, 0);

	for (const cell of toHandles(objc, safeInvoke(objc, entry.collection, 'visibleCells'))) {
		const index = itemOfCell(objc, entry.collection, cell);
		const frame = index === undefined ? undefined : entry.baseItems.get(index);

		if (frame) setFrame(objc, cell, frame);
	}

	const baseItems = [...entry.baseItems.values()];
	const baseHeight = baseItems.length
		? Math.max(...baseItems.map((item) => item.y + item.height))
		: entry.plan?.baseHeight;

	if (baseHeight !== undefined) {
		const size = readSize(safeInvoke(objc, entry.collection, 'contentSize'));
		const frame = frameOf(objc, entry.collection);

		setContentSize(objc, entry.collection, {
			height: baseHeight,
			width: size.width ?? frame?.width ?? 0,
		});

		if (frame) setFrame(objc, entry.collection, { ...frame, height: baseHeight });
	}

	const table = markTableDirty(session, entry.ownerTableKey);

	if (table) scheduleTableLayout(session, table);
}

/**
 * @description Gets the layout of a message's reaction collection, resetting it when the view now shows another message.
 * @param session The running session.
 * @param layout The collection's `UICollectionViewLayout`.
 * @param collection The `UICollectionView`.
 * @param list The `DCDReactionListView` holding it.
 * @param ownerMessageKey The message the collection shows.
 * @returns The collection's layout entry.
 */
export function layoutEntry(
	session: Session,
	layout: NativeObjectHandle,
	collection: NativeObjectHandle,
	list: NativeObjectHandle,
	ownerMessageKey: string,
): LayoutEntry {
	const { objc } = session;
	const layoutKey = key(objc, collection);
	const count = itemCount(objc, collection);
	const ownerCell = ancestorOfClass(objc, list, NativeClass.messageCell);
	const ownerTable = ancestorOfClass(objc, list, NativeClass.table);
	const ownerCellKey = ownerCell ? key(objc, ownerCell) : '';
	const ownerTableKey = ownerTable ? key(objc, ownerTable) : '';
	const existing = session.layouts.get(layoutKey);

	if (!existing) {
		const entry: LayoutEntry = {
			ancestorFrames: captureAncestorFrames(session, list),
			appliedCells: new Map(),
			appliedRevision: -1,
			appliedWidth: -1,
			baseItems: new Map(),
			collection,
			extraWidths: new Map(),
			invalidationScheduled: false,
			itemCount: count,
			layout,
			list,
			ownerCell,
			ownerCellKey,
			ownerMessageKey,
			ownerTableKey,
			plan: null,
			revision: 0,
		};

		session.layouts.set(layoutKey, entry);

		return entry;
	}

	// UIKit reuses the collection for another message; drop everything measured for the old one.
	if (
		existing.ownerMessageKey !== ownerMessageKey ||
		existing.itemCount !== count ||
		existing.ownerCellKey !== ownerCellKey
	) {
		const released = releaseStates(session, (state) => state.layoutKey === layoutKey);

		if (released) invalidateLayout(session, layoutKey);

		restoreLayout(session, existing);
		existing.baseItems.clear();
		existing.appliedCells.clear();
		existing.extraWidths.clear();
		existing.itemCount = count;
		existing.ancestorFrames = captureAncestorFrames(session, list);
		existing.ownerMessageKey = ownerMessageKey;
		existing.plan = null;
		existing.revision++;
	}

	existing.collection = collection;
	existing.layout = layout;
	existing.list = list;
	existing.ownerCell = ownerCell;
	existing.ownerCellKey = ownerCellKey;
	existing.ownerTableKey = ownerTableKey;

	return existing;
}

/**
 * @description Records a pill's frame as Discord laid it out, if it changed.
 * @param session The running session.
 * @param entry The collection's layout.
 * @param index The pill's item index.
 * @param frame Its frame, or `undefined` when it could not be read.
 */
export function captureLayoutItem(
	session: Session,
	entry: LayoutEntry,
	index: number,
	frame: Frame | undefined,
): void {
	if (!frame) return;

	const previous = entry.baseItems.get(index);

	if (
		previous?.x === frame.x &&
		previous.y === frame.y &&
		previous.width === frame.width &&
		previous.height === frame.height
	) {
		return;
	}

	entry.baseItems.set(index, {
		height: frame.height,
		index,
		width: frame.width,
		x: frame.x,
		y: frame.y,
	});
	markChanged(session, entry);
}

/**
 * @description Reads every pill's frame from the collection layout, including pills scrolled out of view.
 * @param session The running session.
 * @param entry The collection's layout.
 */
export function captureLayoutItems(session: Session, entry: LayoutEntry): void {
	if (entry.baseItems.size >= entry.itemCount) return;

	const { objc } = session;
	const indexPathClass = objc.getClass('NSIndexPath');

	if (!indexPathClass) return;

	for (
		let section = 0, sections = sectionCount(objc, entry.collection);
		section < sections;
		section++
	) {
		for (
			let item = 0, count = sectionItemCount(objc, entry.collection, section);
			item < count;
			item++
		) {
			const indexPath = safeInvoke(
				objc,
				indexPathClass,
				'indexPathForItem:inSection:',
				item,
				section,
			);

			if (!indexPath) {
				continue;
			}

			const attributes = safeInvoke(
				objc,
				entry.layout,
				'layoutAttributesForItemAtIndexPath:',
				indexPath,
			) as NativeObjectHandle | null;

			if (!attributes) {
				continue;
			}

			captureLayoutItem(
				session,
				entry,
				item,
				readRect(safeInvoke(objc, attributes, 'frame')),
			);
		}
	}
}

/**
 * @description Reads a pill's width as Discord laid it out.
 * @param session The running session.
 * @param layoutKey The collection's key.
 * @param index The pill's item index.
 * @returns The width, or `undefined` before it was captured.
 */
export function baseItemWidth(
	session: Session,
	layoutKey: string,
	index: number,
): number | undefined {
	return session.layouts.get(layoutKey)?.baseItems.get(index)?.width;
}

/**
 * @description Sets how much wider a pill is for its avatar stack.
 * @param session The running session.
 * @param layoutKey The collection's key.
 * @param index The pill's item index.
 * @param width The extra width, `0` for none.
 */
export function setExtraWidth(
	session: Session,
	layoutKey: string,
	index: number,
	width: number,
): void {
	const entry = session.layouts.get(layoutKey);

	if (!entry) return;

	if (Math.abs((entry.extraWidths.get(index) ?? 0) - width) < 1) return;

	if (width > 0) entry.extraWidths.set(index, width);
	else entry.extraWidths.delete(index);

	markChanged(session, entry);
}

/**
 * @description Asks UIKit to lay the collection out again on the next tick, then re-renders its message cell.
 * @param session The running session.
 * @param layoutKey The collection's key.
 */
export function invalidateLayout(session: Session, layoutKey: string): void {
	const { layouts, objc, signal } = session;
	const entry = layouts.get(layoutKey);

	if (!entry || entry.invalidationScheduled) return;

	entry.invalidationScheduled = true;

	setTimeout(() => {
		if (signal.aborted || layouts.get(layoutKey) !== entry) {
			entry.invalidationScheduled = false;

			return;
		}

		try {
			void objc
				.batch([
					{ target: entry.layout, selector: 'invalidateLayout', args: [] },
					{ target: entry.collection, selector: 'setNeedsLayout', args: [] },
					{ target: entry.list, selector: 'invalidateIntrinsicContentSize', args: [] },
					{ target: entry.list, selector: 'setNeedsLayout', args: [] },
				])
				.then(
					() => {
						entry.invalidationScheduled = false;

						if (
							signal.aborted ||
							layouts.get(layoutKey) !== entry ||
							!entry.ownerCell
						) {
							return;
						}

						scheduleCell(session, entry.ownerCell, true);

						const table = ancestorOfClass(objc, entry.ownerCell, NativeClass.table);

						if (table) scheduleTableLayout(session, tableLayout(session, table));
					},
					() => {
						entry.invalidationScheduled = false;
					},
				);
		} catch {
			entry.invalidationScheduled = false;
		}
	}, 0);
}

/**
 * @description Re-measures a message's reaction pills shortly after its reactions changed.
 * @param session The running session.
 * @param messageId The message.
 * @param channelId Its channel, when the event carried one.
 */
export function scheduleLayoutRefresh(
	session: Session,
	messageId: string,
	channelId?: string,
): void {
	const { layoutRefreshes, objc, signal } = session;
	const refreshKey = `${channelId ?? '*'}:${messageId}`;

	clearTimeout(layoutRefreshes.get(refreshKey));
	layoutRefreshes.set(
		refreshKey,
		setTimeout(() => {
			layoutRefreshes.delete(refreshKey);

			if (signal.aborted) return;

			for (const entry of session.layouts.values()) {
				const owned = channelId
					? entry.ownerMessageKey === messageKey(channelId, messageId)
					: entry.ownerMessageKey.endsWith(`:${messageId}`);

				if (!owned) {
					continue;
				}

				restoreLayout(session, entry);
				entry.itemCount = itemCount(objc, entry.collection);
				entry.baseItems.clear();
				entry.appliedCells.clear();
				entry.appliedRevision = -1;
				entry.appliedWidth = -1;
				entry.plan = null;
				entry.revision++;
				safeInvoke(objc, entry.layout, 'invalidateLayout');
				safeInvoke(objc, entry.collection, 'layoutIfNeeded');

				if (entry.ownerCell) scheduleCell(session, entry.ownerCell, true);
			}
		}, 100),
	);
}

/**
 * @description Cancels every pending layout refresh.
 * @param session The running session.
 */
export function cancelLayoutRefreshes(session: Session): void {
	for (const timer of session.layoutRefreshes.values()) clearTimeout(timer);

	session.layoutRefreshes.clear();
}

/**
 * @description Re-measures the message table's rows after each of its layout passes, while a layout is stale.
 * @param session The running session.
 * @param entry The collection's layout.
 */
export function hookOwnerTable(session: Session, entry: LayoutEntry): void {
	const table =
		entry.ownerCell && ancestorOfClass(session.objc, entry.ownerCell, NativeClass.table);

	if (table) hookTableLayout(session, table);
}

/**
 * @description Applies the reflowed layout: pill frames, collection height, ancestor heights and the cell's height.
 * @param session The running session.
 * @param entry The collection's layout.
 */
export function applyLayout(session: Session, entry: LayoutEntry): void {
	const { objc } = session;

	if (entry.extraWidths.size === 0) {
		if (entry.appliedRevision >= 0) restoreLayout(session, entry);
		else setAncestorFrames(session, entry, 0);

		entry.appliedCells.clear();
		entry.appliedRevision = -1;
		entry.appliedWidth = -1;
		flushTableLayout(session, entry.ownerTableKey);

		return;
	}

	captureLayoutItems(session, entry);

	const plan = planLayout(session, entry);

	if (!plan) return;

	const planChanged =
		entry.appliedRevision !== plan.revision || Math.abs(entry.appliedWidth - plan.width) >= 0.5;

	if (planChanged) markTableDirty(session, entry.ownerTableKey);

	if (updateCellHeight(session, entry)) markTableDirty(session, entry.ownerTableKey);

	for (const cell of toHandles(objc, safeInvoke(objc, entry.collection, 'visibleCells'))) {
		const index = itemOfCell(objc, entry.collection, cell);
		const frame = index === undefined ? undefined : plan.frames.get(index);

		if (index === undefined || !frame) {
			continue;
		}

		const cellKey = key(objc, cell);
		const applied = entry.appliedCells.get(cellKey);

		if (
			!framesMatch(frameOf(objc, cell), frame) ||
			!applied ||
			applied.index !== index ||
			applied.revision !== plan.revision
		) {
			setFrame(objc, cell, frame);
			entry.appliedCells.set(cellKey, { index, revision: plan.revision });
		}

		const reactionView = reactionViewOf(objc, cell);
		const state = reactionView ? session.reactions.get(key(objc, reactionView)) : undefined;

		if (state) fitReactionView(session, state);
	}

	const size = readSize(safeInvoke(objc, entry.collection, 'contentSize'));
	const frame = frameOf(objc, entry.collection);
	const contentHeight = size.height ?? 0;
	const frameHeight = frame?.height ?? 0;
	const contentChanged = Math.abs(contentHeight - plan.height) >= 1;
	const frameChanged = Math.abs(frameHeight - plan.height) >= 1;

	if (contentChanged) {
		setContentSize(objc, entry.collection, {
			height: plan.height,
			width: size.width ?? plan.width,
		});
	}

	if (planChanged && (contentChanged || frameChanged)) {
		safeInvoke(objc, entry.collection, 'invalidateIntrinsicContentSize');
		safeInvoke(objc, entry.list, 'invalidateIntrinsicContentSize');
		safeInvoke(objc, entry.list, 'setNeedsLayout');
	}

	if (frameChanged) {
		setFrame(objc, entry.collection, {
			height: plan.height,
			width: frame?.width ?? plan.width,
			x: frame?.x ?? 0,
			y: frame?.y ?? 0,
		});
	}

	const baselineHeight = entry.ancestorFrames[0]?.frame.height;

	if (baselineHeight !== undefined) {
		setAncestorFrames(session, entry, Math.max(0, plan.height - baselineHeight));
	}

	if (planChanged) {
		entry.appliedRevision = plan.revision;
		entry.appliedWidth = plan.width;
	}

	flushTableLayout(session, entry.ownerTableKey);
}

/**
 * @description Restores and forgets the reaction layouts inside one message cell.
 * @param session The running session.
 * @param cellKey The message cell's key.
 */
export function restoreCellLayouts(session: Session, cellKey: string): void {
	for (const [layoutKey, entry] of session.layouts) {
		if (entry.ownerCellKey !== cellKey) {
			continue;
		}

		restoreLayout(session, entry);
		session.layouts.delete(layoutKey);
	}
}

/**
 * @description Restores and forgets every reaction layout.
 * @param session The running session.
 */
export function restoreAllLayouts(session: Session): void {
	for (const entry of session.layouts.values()) restoreLayout(session, entry);

	session.layouts.clear();
}

/**
 * @description Restores every table's reaction layouts and row heights, then forgets all layout state.
 * @param session The running session.
 */
export function disposeLayouts(session: Session): void {
	restoreTables(session, (tableKey) => {
		for (const entry of session.layouts.values()) {
			if (entry.ownerTableKey === tableKey) restoreLayout(session, entry);
		}
	});
	clearCellHeights(session);
	cancelLayoutRefreshes(session);
	session.layouts.clear();
}
