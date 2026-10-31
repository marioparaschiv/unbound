import type { FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import { GuildMemberStore, MessageStore, RoleStore, UserStore } from '~/modules';

type ChangeSource = Partial<FluxStore> | undefined;

function isStore(source: ChangeSource): source is FluxStore {
	return typeof source?.addChangeListener === 'function';
}

/**
 * @description Calls `onChange` once per tick after any store a mention resolves from changes.
 * @param onChange Called when a waiting mention may now resolve.
 * @returns A function that stops listening.
 */
export function subscribeMentionSources(onChange: () => void): () => void {
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

	const removers = sources.filter(isStore).map((store) => flux.onStoreChange(store, listener));

	return () => {
		for (const remove of removers) remove();
	};
}

export default subscribeMentionSources;
