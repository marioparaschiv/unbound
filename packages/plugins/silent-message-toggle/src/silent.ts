import { SUPPRESS_NOTIFICATIONS } from '~/constants';

export type ToggleOptions = {
	persist: boolean;
	autoDisable: boolean;
};

type ToggleState = {
	enabled: boolean;
	channelId: string | null;
	listeners: Set<() => void>;
};

export type SilentToggle = {
	isActive: (channelId: string, persist: boolean) => boolean;
	toggle: (channelId: string, persist: boolean) => boolean;
	takeForSend: (channelId: string, options: ToggleOptions) => boolean;
	switchChannel: (channelId: string | null | undefined, persist: boolean) => void;
	reset: () => void;
	subscribe: (listener: () => void) => () => void;
};

/**
 * @description Adds Discord's SUPPRESS_NOTIFICATIONS bit to a message's flags, the flag Discord sets when a message starts with `@silent `.
 * @param flags The flags already on the send options, if any.
 * @returns The flags with the silent bit set, keeping every other bit.
 */
export function withSilentFlag(flags: unknown): number {
	const current = typeof flags === 'number' && Number.isInteger(flags) ? flags : 0;

	return current | SUPPRESS_NOTIFICATIONS;
}

/**
 * @description Creates the toggle's state, shared across bundle evaluations when given the same state object.
 * @param state Where the toggle keeps whether it is on and the channel it was turned on in.
 * @returns The toggle's reads, writes and change subscription.
 */
export function createSilentToggle(
	state: ToggleState = { enabled: false, channelId: null, listeners: new Set() },
): SilentToggle {
	function update(enabled: boolean, channelId: string | null) {
		if (state.enabled === enabled && state.channelId === channelId) return;

		state.enabled = enabled;
		state.channelId = channelId;

		for (const listener of state.listeners) listener();
	}

	function isActive(channelId: string, persist: boolean) {
		return state.enabled && (persist || state.channelId === channelId);
	}

	return {
		isActive,
		toggle(channelId, persist) {
			const next = !isActive(channelId, persist);

			update(next, channelId);

			return next;
		},
		takeForSend(channelId, { persist, autoDisable }) {
			if (!isActive(channelId, persist)) return false;

			if (autoDisable) update(false, null);

			return true;
		},
		switchChannel(channelId, persist) {
			if (persist || !state.enabled || state.channelId === channelId) return;

			update(false, null);
		},
		reset() {
			update(false, null);
		},
		subscribe(listener) {
			state.listeners.add(listener);

			return () => void state.listeners.delete(listener);
		},
	};
}

/**
 * @description Reads the toggle kept on a global key, so buttons still mounted from an earlier evaluation of the bundle share it.
 * @param pluginId The plugin's ID, which keys the state.
 * @returns The shared toggle.
 */
export function sharedSilentToggle(pluginId: string): SilentToggle {
	const host: Record<symbol, ToggleState | undefined> = globalThis;
	const key = Symbol.for(`${pluginId}.silent-toggle`);

	return createSilentToggle(
		(host[key] ??= { enabled: false, channelId: null, listeners: new Set() }),
	);
}
