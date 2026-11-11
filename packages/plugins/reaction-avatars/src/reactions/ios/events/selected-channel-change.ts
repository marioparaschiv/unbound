import { scanVisibleCells } from '~/reactions/ios/visible-cells';
import { cancelLayoutRefreshes } from '~/reactions/ios/collections';
import { clearRenderedCells } from '~/reactions/ios/renderer';
import { selectedChannelId } from '@unbound-plugins/shared/metro/selected-channel';
import type { Session } from '~/reactions/ios/session';
import { SelectedChannelStore } from '~/reactions/modules';
import { flux } from '@unbound-app/api';

/**
 * @description Drops every avatar when the user switches channel, then renders the new channel's cells as they settle.
 * The Addon scope removes the listener and the pending scans when the plugin stops.
 * @param session The running session.
 */
export function subscribeChannelChanges(session: Session): void {
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
