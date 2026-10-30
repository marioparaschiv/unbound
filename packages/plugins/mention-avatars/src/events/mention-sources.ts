import { GuildMemberStore, MessageStore, RoleStore, UserStore } from '~/modules';

type ChangeSource = {
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};

/**
 * @description Calls `onChange` once per tick after any store a mention resolves from changes.
 * @param onChange Called when a waiting mention may now resolve.
 * @returns A function that stops listening.
 */
export function subscribeMentionSources(onChange: () => void): () => void {
	const sources = [MessageStore, UserStore, GuildMemberStore, RoleStore] as ChangeSource[];
	let queued: ReturnType<typeof setTimeout> | null = null;

	function listener() {
		if (queued) return;

		queued = setTimeout(() => {
			queued = null;
			onChange();
		}, 0);
	}

	for (const source of sources) source?.addChangeListener?.(listener);

	return () => {
		for (const source of sources) source?.removeChangeListener?.(listener);

		if (queued) clearTimeout(queued);
	};
}

export default subscribeMentionSources;
