import { findVisibleCells } from '@unbound-plugins/shared/native/visible-cells';

import { selectedChannelId } from '~/selected-channel';
import { scheduleCell } from '~/native/cell-queue';
import type { Session } from '~/native/session';
import { NativeClass } from '~/constants';

/**
 * @description Abandons any visible-cell scan in progress.
 * @param session The running session.
 */
export function cancelVisibleScans(session: Session): void {
	session.scanRevision++;
}

/**
 * @description Renders every message cell on screen, for cells that appeared before the hooks.
 * @param session The running session.
 */
export async function scanVisibleCells(session: Session): Promise<void> {
	const scan = ++session.scanRevision;
	const channelId = selectedChannelId();
	const cells = await findVisibleCells(session.objc, NativeClass.messageCell, session.signal);

	if (scan !== session.scanRevision || channelId !== selectedChannelId()) return;

	for (const cell of cells) scheduleCell(session, cell, true);
}

/**
 * @description Renders the cells already on screen on the next tick.
 * @param session The running session.
 * @returns A function that cancels the scan if it has not run.
 */
export function scanInitialCells(session: Session): () => void {
	const timer = setTimeout(() => void scanVisibleCells(session), 0);

	return () => clearTimeout(timer);
}
