import type { NativeBatchStep, NativeObjectHandle } from '@unbound-app/api/native';
import { safeInvoke } from '@unbound-plugins/shared/native/safe-invoke';

import { BottomScroll, SCROLL_STATE, Surface, TABLE_METRICS } from '~/constants';
import { layoutMetricsFromNative, readSurfaceAnchor } from '~/surface-layout';
import type { EmbeddedSurface } from '~/native/surfaces';
import type { Session } from '~/native/session';
import { findTable } from '~/native/objc';
import { MessageStore } from '~/modules';

function steps(target: NativeObjectHandle, selectors: string[]): NativeBatchStep[] {
	return selectors.map((selector) => ({ target, selector, args: [] }));
}

function followsLatestMessage(surface: EmbeddedSurface): boolean {
	return MessageStore.getLastMessage(surface.target.channelId)?.id === surface.messageId;
}

/**
 * @description Remembers whether the chat is at its bottom before an embed resizes, so the resize can keep it there.
 * @param session The running session.
 * @param surface The embed about to resize.
 * @param table The chat's table view.
 */
export function captureBottomAnchor(
	session: Session,
	surface: EmbeddedSurface,
	table: NativeObjectHandle,
) {
	const values = TABLE_METRICS.map((selector) => safeInvoke(session.objc, table, selector));

	surface.bottomAnchor.capture(
		readSurfaceAnchor(layoutMetricsFromNative(values), followsLatestMessage(surface)),
	);
}

function scheduleBottomScrollCorrection(
	session: Session,
	surface: EmbeddedSurface,
	table: NativeObjectHandle,
) {
	const { objc, timers } = session;

	if (!surface.bottomAnchor.pending || surface.bottomScrollTimer || surface.bottomScrollPending) {
		return;
	}

	let attempts = 0;

	async function correct() {
		surface.bottomScrollTimer = undefined;

		if (surface.disposed) {
			surface.bottomAnchor.clear();

			return;
		}

		surface.bottomScrollPending = true;

		try {
			const values = await objc.batch([
				...steps(surface.label, ['layoutIfNeeded']),
				...steps(surface.cell, ['layoutIfNeeded']),
				...steps(table, ['layoutIfNeeded', ...TABLE_METRICS, ...SCROLL_STATE]),
			]);

			if (surface.disposed) {
				surface.bottomAnchor.clear();

				return;
			}

			const metrics = layoutMetricsFromNative(values.slice(3, 8));
			const correction = surface.bottomAnchor.correction(
				metrics,
				values.slice(8).some(Boolean),
			);

			if (correction) {
				const scrolling = await objc.batch(steps(table, SCROLL_STATE));

				if (surface.disposed) {
					surface.bottomAnchor.clear();

					return;
				}

				if (!scrolling.some(Boolean)) {
					await objc.invokeAsync(table, 'setContentOffset:animated:', [
						objc.struct('CGPoint', correction),
						false,
					]);
				}

				return;
			}

			// The row has not published its new height yet; look again next frame.
			if (surface.bottomAnchor.pending && attempts < BottomScroll.attempts) {
				attempts++;
				surface.bottomScrollTimer = timers.later(() => void correct(), BottomScroll.frame);

				return;
			}

			surface.bottomAnchor.clear();
		} catch {
			surface.bottomAnchor.clear();
		} finally {
			surface.bottomScrollPending = false;
		}
	}

	surface.bottomScrollTimer = timers.later(() => void correct(), BottomScroll.frame);
}

/**
 * @description Cancels a pending reaction scroll correction.
 * @param session The running session.
 * @param surface The embed.
 */
export function clearReactionLayout(session: Session, surface: EmbeddedSurface) {
	session.timers.cancel(surface.reactionLayoutTimer);
	surface.reactionLayoutTimer = undefined;
}

/**
 * @description Keeps the chat at its bottom after the message holding an embed gains or loses a reaction row.
 * @param session The running session.
 * @param surface The embed whose message's reactions changed.
 */
export function scheduleReactionScrollCorrection(session: Session, surface: EmbeddedSurface) {
	clearReactionLayout(session, surface);
	surface.reactionLayoutTimer = session.timers.later(() => {
		surface.reactionLayoutTimer = undefined;

		if (surface.disposed) return;

		void findTable(session.objc, surface.cell)
			.then((table) => {
				if (surface.disposed) return;

				surface.table = table;

				if (table) scheduleBottomScrollCorrection(session, surface, table);
			})
			.catch(() => undefined);
	}, Surface.settleDelay);
}

/**
 * @description Makes the table re-measure the row that holds an embed, then keeps the chat at its bottom.
 * @param session The running session.
 * @param surface The embed whose height changed.
 * @param force Whether to re-measure even when the height is the one last measured.
 */
export function refreshRowSize(session: Session, surface: EmbeddedSurface, force: boolean) {
	const { objc } = session;

	if (!force && surface.lastInvalidatedHeight === surface.height) return;

	surface.lastInvalidatedHeight = surface.height;

	const generation = ++surface.rowRefreshGeneration;

	function isCurrent() {
		return !surface.disposed && surface.rowRefreshGeneration === generation;
	}

	async function refresh() {
		try {
			const table = await findTable(objc, surface.cell);

			if (!isCurrent()) return;

			if (!table) {
				surface.table = null;
				surface.lastInvalidatedHeight = -1;
				surface.bottomAnchor.clear();

				return;
			}

			surface.table = table;

			const values = await objc.batch([
				...steps(table, TABLE_METRICS),
				...steps(surface.label, ['invalidateIntrinsicContentSize', 'setNeedsLayout']),
				...steps(surface.cell, ['setNeedsUpdateConstraints', 'setNeedsLayout']),
				...steps(table, ['beginUpdates', 'endUpdates']),
			]);

			if (!isCurrent()) return;

			surface.bottomAnchor.capture(
				readSurfaceAnchor(
					layoutMetricsFromNative(values.slice(0, TABLE_METRICS.length)),
					followsLatestMessage(surface),
				),
			);
			scheduleBottomScrollCorrection(session, surface, table);
		} catch {
			if (surface.rowRefreshGeneration !== generation) return;

			surface.lastInvalidatedHeight = -1;
			surface.bottomAnchor.clear();
		}
	}

	void refresh();
}
