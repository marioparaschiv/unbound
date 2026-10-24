import { shouldCorrectRow } from '~/layout';
import { Limits } from '~/constants';

import type { Session, Surface } from './session';
import { detachSurface, isMounted, isOnScreen, visibleChannelId } from './session';
import { measureRow, tableForCell } from './cells';

function isCurrent(session: Session, surface: Surface): boolean {
	return isMounted(session, surface) && visibleChannelId() === surface.channelId;
}

/**
 * @description Asks the message table to re-measure a surface's row after its text changed.
 * @param session The renderer session.
 * @param surface The surface.
 */
export function updateRow(session: Session, surface: Surface): void {
	const { ui } = session;

	if (!isOnScreen(session, surface)) return;

	ui.call(surface.label, 'invalidateIntrinsicContentSize');
	ui.call(surface.label, 'setNeedsLayout');
	ui.call(surface.cell, 'setNeedsUpdateConstraints');
	ui.call(surface.cell, 'setNeedsLayout');

	const table = tableForCell(ui, surface.cell);

	if (!table) return;

	surface.table = table;
	ui.call(table, 'beginUpdates');
	ui.call(table, 'endUpdates');
	scheduleRowCorrection(session, surface, 32);
}

/**
 * @description Checks a surface's row height soon, once at a time and a bounded number of times.
 * @param session The renderer session.
 * @param surface The surface.
 * @param delay Milliseconds to wait for layout to settle.
 */
export function scheduleRowCorrection(
	session: Session,
	surface: Surface,
	delay: number = 16,
): void {
	if (surface.rowTimer || surface.rowCorrectionPending) return;

	if (surface.rowRetries >= Limits.rowRetries) return;

	surface.rowTimer = setTimeout(() => {
		surface.rowTimer = null;

		if (!isCurrent(session, surface)) return;

		surface.rowCorrectionPending = true;
		void correctRow(session, surface);
	}, delay);
}

// UIKit sometimes keeps a row at its pre-card height; an empty update batch makes the table re-measure it.
async function correctRow(session: Session, surface: Surface): Promise<void> {
	const { objc } = session.ui;
	let retry = false;

	try {
		const geometry = await measureRow(objc, surface.cell, surface.label);

		if (!isCurrent(session, surface)) return;

		if (!geometry) {
			detachSurface(session, surface);

			return;
		}

		if (!shouldCorrectRow(geometry.cellHeight, geometry.contentHeight, geometry.labelBottom)) {
			surface.rowRetries = 0;

			return;
		}

		const { table } = surface;

		if (!table) return;

		const scrolling = await objc.batch([
			{ target: table, selector: 'isTracking', args: [] },
			{ target: table, selector: 'isDragging', args: [] },
			{ target: table, selector: 'isDecelerating', args: [] },
		]);

		if (!isCurrent(session, surface) || scrolling.some(Boolean)) return;

		surface.rowRetries++;

		await objc.batch([
			{ target: table, selector: 'beginUpdates', args: [] },
			{ target: table, selector: 'endUpdates', args: [] },
		]);

		retry = isCurrent(session, surface);
	} catch {
		// A failed native call ends correction for this surface.
	} finally {
		surface.rowCorrectionPending = false;

		if (retry) scheduleRowCorrection(session, surface, 80);
	}
}

export default { updateRow, scheduleRowCorrection };
