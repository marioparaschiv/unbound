/** The listeners a plugin added through the fake API and has not removed, for `stopPlugin`'s leak check. */
export type ListenerRegistry = {
	/** Records a listener; the returned function removes it, calling `remove` once. */
	track: (label: string, remove: () => void) => () => void;
	/** The label of each listener still added, in the order they were added. */
	active: () => string[];
	/** Removes every listener still added. */
	clear: () => void;
};

type Listener = { label: string; remove: () => void };

/**
 * @description Creates a registry of the listeners a plugin holds.
 * @returns The registry.
 */
export function createListenerRegistry(): ListenerRegistry {
	const listeners = new Map<symbol, Listener>();

	return {
		track(label, remove) {
			const id = Symbol(label);

			listeners.set(id, { label, remove });

			return () => {
				if (!listeners.delete(id)) return;

				remove();
			};
		},
		active: () => [...listeners.values()].map(({ label }) => label),
		clear() {
			for (const { remove } of listeners.values()) remove();

			listeners.clear();
		},
	};
}
