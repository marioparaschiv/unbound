export type SurfaceListeners = {
	/** Calls `listener` whenever the surface is notified; returns the function that stops it. */
	subscribe: (surfaceId: string, listener: () => void) => () => void;
	/** Calls every listener of one surface. */
	notify: (surfaceId: string) => void;
	/** Drops every listener. */
	clear: () => void;
};

/**
 * @description Keeps the re-render listeners of the Fabric surfaces a plugin draws, by surface id.
 * @returns The listener registry.
 */
export function createSurfaceListeners(): SurfaceListeners {
	const listeners = new Map<string, Set<() => void>>();

	return {
		subscribe(surfaceId, listener) {
			const set = listeners.get(surfaceId) ?? new Set();

			set.add(listener);
			listeners.set(surfaceId, set);

			return () => {
				set.delete(listener);

				if (!set.size) {
					listeners.delete(surfaceId);
				}
			};
		},
		notify(surfaceId) {
			for (const listener of listeners.get(surfaceId) ?? []) listener();
		},
		clear() {
			listeners.clear();
		},
	};
}

export default createSurfaceListeners;
