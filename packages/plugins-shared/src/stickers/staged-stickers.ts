export type Sticker = { id: string | number; opaque?: boolean };

export type StagedStickers = ReturnType<typeof createStagedStickers>;

const NO_STICKERS: readonly Sticker[] = Object.freeze([]);

declare global {
	var __unboundStagedStickers: StagedStickers | undefined;
}

/**
 * @description Holds the stickers waiting to be sent in each channel, notifying that channel's subscribers on change.
 * @returns `get`, `set` and `add` the channel's stickers, `subscribe` to a channel, and list the `channels` holding any.
 */
export function createStagedStickers() {
	const staged = new Map<string, Sticker[]>();
	const listeners = new Map<string, Set<() => void>>();

	function get(channelId: string): Sticker[] {
		return staged.get(channelId) ?? (NO_STICKERS as Sticker[]);
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

/**
 * @description Returns the staged stickers every plugin bundle shares, so Preview Message can show what Sticker Preview staged.
 * @returns The one staged-sticker store kept on `globalThis`.
 */
export function sharedStagedStickers(): StagedStickers {
	return (globalThis.__unboundStagedStickers ??= createStagedStickers());
}
