const INTENDED_KEY = '__unboundIntendedVoiceJoin';

type IntendedHolder = Record<typeof INTENDED_KEY, number | undefined>;

/**
 * @description Runs a voice join a plugin makes for the user on purpose, such as following a friend, so Call Join
 * Confirmation lets it through without asking. Plugins bundle their own copy of this module, so it counts on `globalThis`.
 * @template T What the join returns.
 * @param join Calls `selectVoiceChannel` or `call`, synchronously.
 * @returns What `join` returned.
 */
export function joinOnPurpose<T>(join: () => T): T {
	const holder = globalThis as unknown as IntendedHolder;

	holder[INTENDED_KEY] = (holder[INTENDED_KEY] ?? 0) + 1;

	try {
		return join();
	} finally {
		holder[INTENDED_KEY] = (holder[INTENDED_KEY] ?? 1) - 1;
	}
}

/**
 * @description Whether the voice join running right now came through `joinOnPurpose`.
 * @returns Whether a plugin is joining on the user's behalf.
 */
export function isJoiningOnPurpose(): boolean {
	return ((globalThis as unknown as IntendedHolder)[INTENDED_KEY] ?? 0) > 0;
}
