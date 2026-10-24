export type Sticker = { id: string | number; opaque?: boolean };

export type StagedStickers = ReturnType<typeof createStagedStickers>;

/**
 * @description Holds the stickers waiting to be sent in each channel, notifying that channel's subscribers on change.
 * @returns `get`, `set` and `add` the channel's stickers, `subscribe` to a channel, and list the `channels` holding any.
 */
export function createStagedStickers() {
	const staged = new Map<string, Sticker[]>();
	const listeners = new Map<string, Set<() => void>>();

	function get(channelId: string): Sticker[] {
		return staged.get(channelId) ?? [];
	}

	function set(channelId: string, stickers: Sticker[]) {
		if (stickers.length) {
			staged.set(channelId, stickers);
		} else {
			staged.delete(channelId);
		}

		for (const listener of listeners.get(channelId) ?? []) listener();
	}

	function add(channelId: string, sticker: Sticker) {
		const current = get(channelId);

		if (current.some((item) => String(item.id) === String(sticker.id))) return;

		set(channelId, [...current, sticker]);
	}

	function subscribe(channelId: string, listener: () => void): () => void {
		const channelListeners = listeners.get(channelId) ?? new Set();

		channelListeners.add(listener);
		listeners.set(channelId, channelListeners);

		return () => {
			channelListeners.delete(listener);

			if (!channelListeners.size) listeners.delete(channelId);
		};
	}

	function channels(): string[] {
		return [...staged.keys()];
	}

	return { get, set, add, subscribe, channels };
}
