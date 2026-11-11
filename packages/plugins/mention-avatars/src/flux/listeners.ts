import { selectedChannelId } from '@unbound-plugins/shared/metro/selected-channel';
import type { FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import {
	GuildMemberStore,
	MessageStore,
	RoleStore,
	SelectedChannelStore,
	UserStore,
} from '~/lib/modules';
import type { VisibleCellScanner } from '~/native/visible-cells-ios';
import type { Renderer } from '~/native/renderer-ios';

type ChangeSource = Partial<FluxStore> | undefined;

function isStore(source: ChangeSource): source is FluxStore {
	return typeof source?.addChangeListener === 'function';
}

/**
 * @description Calls `onChange` once per tick after any store a mention resolves from changes.
 * The Addon scope stops the listeners when the plugin stops.
 * @param onChange Called when a waiting mention may now resolve.
 */
export function listenToMentionSources(onChange: () => void): void {
	const sources = [MessageStore, UserStore, GuildMemberStore, RoleStore] as ChangeSource[];
	let queued = false;

	function listener() {
		if (queued) return;

		queued = true;
		setTimeout(() => {
			queued = false;
			onChange();
		}, 0);
	}

	for (const store of sources.filter(isStore)) flux.onStoreChange(store, listener);
}

/**
 * @description Renders the cells on screen now, then starts over in each newly selected channel: restores the old cells and scans the new ones.
 * The Addon scope stops the listener and the scan timers when the plugin stops.
 * @param renderer The mention renderer.
 * @param scanner The visible cell scanner.
 */
export function listenToSelectedChannel(renderer: Renderer, scanner: VisibleCellScanner): void {
	let channelId = selectedChannelId();

	// The store also emits for changes that keep the same channel selected.
	function onChange() {
		const next = selectedChannelId();

		if (!next || next === channelId) return;

		channelId = next;
		renderer.clear();
		scanner.schedule();
	}

	flux.onStoreChange(SelectedChannelStore, onChange);
	scanner.schedule();
}
