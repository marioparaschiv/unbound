import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';

import { selectedChannelId } from '@unbound-plugins/shared/metro/selected-channel';
import { scheduleCell } from '~/native/ios/cell-queue';
import type { Session } from '~/native/ios/session';
import { NativeClass } from '~/lib/constants';

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
 * The Addon scope cancels the scan if it has not run when the plugin stops.
 */
export function scanInitialCells(session: Session): void {
	setTimeout(() => void scanVisibleCells(session), 0);
}
