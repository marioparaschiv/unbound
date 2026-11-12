/** When a send takes the toggle: kept on in other channels with `persist`, turned off after it with `autoDisable`. */
export type ToggleOptions = { persist: boolean; autoDisable: boolean };

type ToggleState = { enabled: boolean; channelId: string | null; listeners: Set<() => void> };

/** A chat input toggle that is on for one channel, or for every channel while Persist State is on. */
export type ChannelToggle = {
	isActive: (channelId: string, persist: boolean) => boolean;
	toggle: (channelId: string, persist: boolean) => boolean;
	takeForSend: (channelId: string, options: ToggleOptions) => boolean;
	switchChannel: (channelId: string | null | undefined, persist: boolean) => void;
	subscribe: (listener: () => void) => () => void;
};

/**
 * @description Creates a chat input toggle's state; it starts on in every channel with `startOn`, as for a mode the user turned the plugin on for.
 * @param startOn Whether the toggle starts on.
 * @returns The toggle's reads, writes and change subscription.
 */
export function createChannelToggle(startOn = false): ChannelToggle {
	const state: ToggleState = { enabled: startOn, channelId: null, listeners: new Set() };

	function update(enabled: boolean, channelId: string | null) {
		if (state.enabled === enabled && state.channelId === channelId) return;

		state.enabled = enabled;
		state.channelId = channelId;

		for (const listener of state.listeners) listener();
	}

	function isActive(channelId: string, persist: boolean) {
		return (
			state.enabled && (persist || state.channelId === null || state.channelId === channelId)
		);
	}

	return {
		isActive,
		toggle(channelId, persist) {
			const next = !isActive(channelId, persist);

			update(next, channelId);

			return next;
		},
		takeForSend(channelId, { persist, autoDisable }) {
			if (!isActive(channelId, persist)) {
				return false;
			}

			if (autoDisable) {
				update(false, null);
			}

			return true;
		},
		switchChannel(channelId, persist) {
			if (
				persist ||
				!state.enabled ||
				state.channelId === null ||
				state.channelId === channelId
			) {
				return;
			}

			update(false, null);
		},
		subscribe(listener) {
			state.listeners.add(listener);

			return () => void state.listeners.delete(listener);
		},
	};
}

export default createChannelToggle;
