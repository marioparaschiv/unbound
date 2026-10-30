import { scanVisibleCells } from '~/native/visible-cells';
import { cancelLayoutRefreshes } from '~/native/collections';
import { clearRenderedCells } from '~/native/renderer';
import { selectedChannelId } from '~/selected-channel';
import type { Session } from '~/native/session';
import { SelectedChannelStore } from '~/modules';

/**
 * @description Drops every avatar when the user switches channel, then renders the new channel's cells as they settle.
 * @param session The running session.
 * @returns A function that stops listening and cancels pending scans.
 */
export function subscribeChannelChanges(session: Session): () => void {
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

	SelectedChannelStore.addChangeListener(onChange);

	return () => {
		SelectedChannelStore.removeChangeListener(onChange);
		cancelScans();
	};
}
