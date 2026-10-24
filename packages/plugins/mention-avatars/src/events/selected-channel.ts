import type { VisibleCellScanner } from '~/native/visible-cells';
import type { Renderer } from '~/native/renderer';
import { SelectedChannelStore } from '~/modules';

function selectedChannelId(): string | undefined {
	return SelectedChannelStore.getChannelId() ?? SelectedChannelStore.getLastSelectedChannelId();
}

/**
 * @description Renders the cells on screen now, then starts over in each newly selected channel: restores the old cells and scans the new ones.
 * @param renderer The mention renderer.
 * @param scanner The visible cell scanner.
 * @returns A function that stops listening and cancels pending scans.
 */
export function subscribeSelectedChannel(
	renderer: Renderer,
	scanner: VisibleCellScanner,
): () => void {
	let channelId = selectedChannelId();

	// The store also emits for changes that keep the same channel selected.
	function onChange() {
		const next = selectedChannelId();

		if (!next || next === channelId) return;

		channelId = next;
		renderer.clear();
		scanner.schedule();
	}

	SelectedChannelStore.addChangeListener(onChange);
	scanner.schedule();

	return () => {
		SelectedChannelStore.removeChangeListener(onChange);
		scanner.cancel();
	};
}

export default subscribeSelectedChannel;
