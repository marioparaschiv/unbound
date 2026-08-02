// Zustand store test substrate. Owns one contract: restoring a store to the exact state its
// initializer produced, so tests never observe each other's writes. It models nothing about any
// particular store's shape, and does not reset subscribers, middleware, or persisted storage.

/** The subset of zustand's vanilla store API a reset needs. */
export interface ResettableStore<T> {
	getState: () => T;
	setState: (state: T, replace: true) => void;
}

/**
 * @description Snapshots a store's current state and returns a function restoring that snapshot.
 * Call at module scope so the snapshot is the initializer's output, then invoke the returned
 * function in `beforeEach`.
 * @template T The store's state type.
 * @param store The zustand store to snapshot.
 * @returns A function that replaces the store's state with the snapshot.
 */
export function resetStore<T>(store: ResettableStore<T>): () => void {
	// Replace mode, so keys a test added are dropped rather than merged over.
	const initial = { ...store.getState() };

	return () => store.setState({ ...initial }, true);
}

export default { resetStore };
