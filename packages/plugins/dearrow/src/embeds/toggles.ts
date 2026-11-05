export type Toggles = ReturnType<typeof createToggles>;

/**
 * @description Remembers, for the session, the messages the user switched between dearrowed and original.
 * @param byDefault Reads whether embeds are dearrowed when the user has not switched them.
 * @returns `isDearrowed` reads a message's state, `toggle` flips it, `clear` forgets every switch.
 */
export function createToggles(byDefault: () => boolean) {
	const switched = new Map<string, boolean>();

	function isDearrowed(messageId: unknown): boolean {
		if (typeof messageId !== 'string') return byDefault();

		return switched.get(messageId) ?? byDefault();
	}

	function toggle(messageId: string): boolean {
		const next = !isDearrowed(messageId);

		switched.set(messageId, next);

		return next;
	}

	function clear() {
		switched.clear();
	}

	return { isDearrowed, toggle, clear };
}
