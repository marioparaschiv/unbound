import type { FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import { GuildMemberStore, MessageStore, RoleStore, UserStore } from '~/avatars/modules';

type ChangeSource = Partial<FluxStore> | undefined;

function isStore(source: ChangeSource): source is FluxStore {
	return typeof source?.addChangeListener === 'function';
}

/**
 * @description Calls `onChange` once per tick after any store a mention resolves from changes.
 * The Addon scope stops the listeners when the plugin stops.
 * @param onChange Called when a waiting mention may now resolve.
 */
export function subscribeMentionSources(onChange: () => void): void {
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
