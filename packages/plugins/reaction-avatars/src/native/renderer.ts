import type { MessageCellHandlers } from '@unbound-plugins/shared/native/message-cell-hooks';
import type { NativeObjectHandle } from '@unbound-app/api/native';

import {
	applyLayout,
	captureLayoutItem,
	captureLayoutItems,
	disposeLayouts,
	hookOwnerTable,
	layoutEntry,
	restoreAllLayouts,
	restoreCellLayouts,
} from '~/native/collections';
import { disposeState, followReactionView, syncReactionView } from '~/native/reaction-surfaces';
import { messageKey, reactionContext, type Reaction } from '~/reaction-context';
import { forgetCell, forgetCells, scheduleCell } from '~/native/cell-queue';
import { itemOfCell, key, reactionViewOf, toHandles } from '~/native/views';
import type { MessageInfo, Session } from '~/native/session';
import type { ReactionCellViews } from '~/native/cell-views';
import { releaseStates } from '~/native/reaction-views';
import { surfaceStates } from '~/surface-states';
import { MessageStore } from '~/modules';

/**
 * @description Stops showing avatars in a message cell and restores its reaction layouts.
 * @param session The running session.
 * @param cellKey The message cell's key.
 */
export function clearCell(session: Session, cellKey: string): void {
	forgetCell(session, cellKey);

	for (const [viewKey, state] of session.reactions) {
		if (state.cellKey === cellKey) disposeState(session, viewKey, state);
	}

	restoreCellLayouts(session, cellKey);
}

/**
 * @description Shows avatars on every visible reaction pill of a message cell and reflows the pills.
 * @param session The running session.
 * @param cell The `DCDMessageTableViewCell`.
 * @param info The message it shows, or `undefined` when it shows none.
 * @param views Its reaction views, or `undefined` when it has no reactions.
 */
export function renderCell(
	session: Session,
	cell: NativeObjectHandle,
	info: MessageInfo | undefined,
	views: ReactionCellViews | undefined,
): void {
	const { objc } = session;
	const cellKey = key(objc, cell);
	const message = info && MessageStore.getMessage(info.channelId, info.messageId);

	if (!info || !message || !views) {
		clearCell(session, cellKey);

		return;
	}

	const { collection } = views;
	const layoutKey = key(objc, collection);
	const entry = layoutEntry(
		session,
		views.layout,
		collection,
		views.list,
		messageKey(info.channelId, info.messageId),
	);

	hookOwnerTable(session, entry);
	captureLayoutItems(session, entry);

	const reactions: Reaction[] = message.reactions ?? [];
	const visibleKeys = new Set<string>();

	for (const collectionCell of toHandles(objc, views.visibleCells)) {
		const index = itemOfCell(objc, collection, collectionCell);

		if (index === undefined) {
			continue;
		}

		if (!entry.baseItems.has(index)) {
			captureLayoutItem(session, entry, index, session.fabric.measure(collectionCell));
		}

		const view = reactionViewOf(objc, collectionCell);

		if (!view) {
			continue;
		}

		const reaction = reactions[index];
		const viewKey = key(objc, view);

		visibleKeys.add(viewKey);
		syncReactionView(
			session,
			{ cellKey, collectionCell, itemIndex: index, layoutKey, view },
			reaction ? reactionContext(info.channelId, info.messageId, reaction) : null,
		);
		followReactionView(session, viewKey);
	}

	releaseStates(
		session,
		(state, viewKey) => state.cellKey === cellKey && !visibleKeys.has(viewKey),
	);
	applyLayout(session, entry);
}

/**
 * @description Renders a message cell's avatars when it appears, is reused or lays out.
 * @param session The running session.
 * @returns The handlers for the shared message cell hooks.
 */
export function messageCellHandlers(session: Session): MessageCellHandlers {
	return {
		// A detached cell keeps its avatars until it is reused.
		shown: (cell) => scheduleCell(session, cell, true),
		laidOut: (cell) => scheduleCell(session, cell),
		reused(cell) {
			clearCell(session, key(session.objc, cell));
			scheduleCell(session, cell, true);
		},
	};
}

/**
 * @description Stops showing avatars everywhere, for a channel switch.
 * @param session The running session.
 */
export function clearRenderedCells(session: Session): void {
	releaseStates(session, () => true);
	restoreAllLayouts(session);
	forgetCells(session);
}

/**
 * @description Removes every avatar and restores every reaction layout and row height, for `stop`.
 * @param session The running session.
 */
export function disposeRenderer(session: Session): void {
	releaseStates(session, () => true);
	disposeLayouts(session);
	session.reactors.clear();
	forgetCells(session);
	session.scheduledCells.clear();
	session.forcedCells.clear();
	surfaceStates.clear();
}
