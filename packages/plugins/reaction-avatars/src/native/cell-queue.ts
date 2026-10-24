import { readNativeMessageInfo } from '@unbound-plugins/shared/native/message-info';
import type { NativeObjectHandle } from '@unbound-app/api/native';

import { readReactionCellViews } from '~/native/cell-views';
import { selectedChannelId } from '~/selected-channel';
import type { Session } from '~/native/session';
import { key } from '~/native/views';

async function readCell(session: Session, cell: NativeObjectHandle) {
	const { objc } = session;
	const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
	const message = await readNativeMessageInfo(cell, objc, selectedChannelId);
	const info = message?.channelId
		? { channelId: message.channelId, messageId: message.messageId }
		: undefined;
	const views = info ? await readReactionCellViews(objc, cell) : undefined;

	// The cell was reused for another message while it was being read.
	if (info && viewModel) {
		const current = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;

		if (!current || !(await objc.invokeAsync(viewModel, 'isEqual:', [current]))) return;
	}

	return { info, views };
}

/**
 * @description Renders a message cell's avatars on the next tick, at most every 250ms unless forced.
 * @param session The running session.
 * @param cell The `DCDMessageTableViewCell`.
 * @param force Render even if the cell rendered moments ago.
 */
export function scheduleCell(
	session: Session,
	cell: NativeObjectHandle,
	force: boolean = false,
): void {
	const { cells, forcedCells, lastRenders, scheduledCells, signal } = session;
	const cellKey = key(session.objc, cell);

	cells.set(cellKey, cell);

	if (!force && Date.now() - (lastRenders.get(cellKey) ?? 0) < 250) return;

	if (scheduledCells.has(cellKey)) {
		if (force) forcedCells.add(cellKey);

		return;
	}

	scheduledCells.add(cellKey);

	setTimeout(() => {
		if (signal.aborted) {
			scheduledCells.delete(cellKey);

			return;
		}

		void readCell(session, cell)
			.then((result) => {
				if (!result || signal.aborted || !cells.has(cellKey)) return;

				lastRenders.set(cellKey, Date.now());
				session.render(session, cell, result.info, result.views);
			})
			.catch(() => undefined)
			.finally(() => {
				if (signal.aborted) return;

				scheduledCells.delete(cellKey);

				if (forcedCells.delete(cellKey)) rescheduleCell(session, cellKey);
			});
	}, 0);
}

/**
 * @description Renders a message cell seen earlier again, now.
 * @param session The running session.
 * @param cellKey The cell's key.
 */
export function rescheduleCell(session: Session, cellKey: string): void {
	const cell = session.cells.get(cellKey);

	if (cell) scheduleCell(session, cell, true);
}

/**
 * @description Forgets a message cell, so it renders fresh next time.
 * @param session The running session.
 * @param cellKey The cell's key.
 */
export function forgetCell(session: Session, cellKey: string): void {
	session.cells.delete(cellKey);
	session.lastRenders.delete(cellKey);
}

/**
 * @description Forgets every message cell seen so far.
 * @param session The running session.
 */
export function forgetCells(session: Session): void {
	session.cells.clear();
	session.lastRenders.clear();
}
