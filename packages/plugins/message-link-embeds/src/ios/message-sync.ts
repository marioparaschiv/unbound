import { flux } from '@unbound-app/api';

import { captureBottomAnchor, scheduleReactionScrollCorrection } from '~/ios/scroll-anchor';
import { reconcileSurfaceText, type EmbeddedSurface } from '~/ios/surfaces';
import { reactionSnapshot } from '~/reaction-state';
import { scanVisibleCells } from '~/ios/cells';
import type { Session } from '~/ios/session';
import { WINDOW_SCAN_DELAY } from '~/constants';
import { currentChannelId } from '~/channels';
import { MessageStore } from '~/modules';

/**
 * @description Follows message store changes: keeps embeds in place when their message's reactions change, and scans for new cells when the loaded messages change.
 * @param session The running session.
 * @returns A function that stops listening.
 */
export function subscribeMessageStore(session: Session): () => void {
	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	let scanTimer: ReturnType<typeof setTimeout> | undefined;
	let windowSignature = '';

	function snapshotOf(surface: EmbeddedSurface) {
		const source = MessageStore.getMessage(surface.target.channelId, surface.messageId);

		return source ? reactionSnapshot(source.reactions) : surface.reactionSnapshot;
	}

	function syncReactions() {
		for (const surface of session.surfaces.values()) {
			const snapshot = snapshotOf(surface);
			const changed = snapshot !== surface.reactionSnapshot;

			if (changed && surface.table) captureBottomAnchor(session, surface, surface.table);

			void reconcileSurfaceText(session, surface);

			if (!changed) continue;

			surface.reactionSnapshot = snapshot;
			scheduleReactionScrollCorrection(session, surface);
		}
	}

	function scheduleWindowScan() {
		const channelId = currentChannelId();
		const messages = channelId ? MessageStore.getMessages(channelId)?._array : undefined;

		if (!channelId || !messages) return;

		const signature = `${channelId}:${messages.length}:${messages[0]?.id}:${messages.at(-1)?.id}`;

		if (signature === windowSignature) return;

		windowSignature = signature;
		clearTimeout(scanTimer);
		scanTimer = setTimeout(() => {
			scanTimer = undefined;
			void scanVisibleCells(session);
		}, WINDOW_SCAN_DELAY);
	}

	function onChange() {
		// Capture the scroll position now, before the reaction row changes the layout.
		for (const surface of session.surfaces.values()) {
			if (surface.table && snapshotOf(surface) !== surface.reactionSnapshot) {
				captureBottomAnchor(session, surface, surface.table);
			}
		}

		syncTimer ??= setTimeout(() => {
			syncTimer = undefined;
			syncReactions();
		});
		scheduleWindowScan();
	}

	return flux.onStoreChange(MessageStore, onChange);
}
