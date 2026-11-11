import { selectedChannelId } from '@unbound-plugins/shared/metro/selected-channel';
import { flux } from '@unbound-app/api';

import { cancelLayoutRefreshes, scheduleLayoutRefresh } from '~/native/collections-ios';
import { reloadReactors } from '~/native/reaction-surfaces-ios';
import { clearRenderedCells } from '~/native/renderer-ios';
import { scanVisibleCells } from '~/native/visible-cells-ios';
import type { Session } from '~/native/session-ios';
import { SelectedChannelStore } from '~/lib/modules';
import { REACTION_ACTIONS } from '~/lib/constants';
import type { ReactionChange } from '~/lib/types';

/**
 * @description Refetches a message's reactors and reflows its pills whenever its reactions change, for every `MESSAGE_REACTION_*` action.
 * The Addon scope removes the listeners when the plugin stops.
 * @param session The running iOS session.
 */
export function listenToReactionChanges(session: Session): void {
	function onReactionChange(event: ReactionChange) {
		const messageId = event.messageId ?? event.message_id;

		if (!messageId) return;

		const channelId = event.channelId ?? event.channel_id;

		session.reactors.invalidateMessage(messageId, channelId);
		scheduleLayoutRefresh(session, messageId, channelId);
		reloadReactors(
			session,
			({ context }) =>
				context.messageId === messageId && (!channelId || context.channelId === channelId),
		);
	}

	for (const action of REACTION_ACTIONS) flux.onAction(action, onReactionChange);
}

/**
 * @description Refetches every shown reactor list after the gateway reconnects, since reactions changed while it was away.
 * The Addon scope removes the listener when the plugin stops.
 * @param session The running iOS session.
 */
export function listenToConnectionOpen(session: Session): void {
	function onConnectionOpen() {
		session.reactors.clear();
		reloadReactors(session, () => true);
	}

	flux.onAction('CONNECTION_OPEN', onConnectionOpen);
}

/**
 * @description Drops every avatar when the user switches channel, then renders the new channel's cells as they settle.
 * The Addon scope removes the listener and the pending scans when the plugin stops.
 * @param session The running iOS session.
 */
export function listenToChannelChanges(session: Session): void {
	const scans = new Set<ReturnType<typeof setTimeout>>();

	let channelId = selectedChannelId();

	function cancelScans() {
		for (const timer of scans) clearTimeout(timer);

		scans.clear();
	}

	function onChange() {
		const next = selectedChannelId();

		if (!next || next === channelId) return;

		channelId = next;
		// Abandons any visible-cell scan in progress.
		session.scanRevision++;
		cancelScans();
		cancelLayoutRefreshes(session);
		clearRenderedCells(session);
		session.reactors.cancelQueuedOutsideChannel(selectedChannelId());

		// The new channel's message list mounts over several frames, so scan a few times.
		for (const delay of [100, 500, 1_500, 3_000]) {
			const timer = setTimeout(() => {
				scans.delete(timer);
				session.reactors.cancelQueuedOutsideChannel(selectedChannelId());
				void scanVisibleCells(session);
			}, delay);

			scans.add(timer);
		}
	}

	flux.onStoreChange(SelectedChannelStore, onChange);
}
