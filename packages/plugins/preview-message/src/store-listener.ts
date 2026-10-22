export type ChangeListenerStore = {
	addChangeListener?: (listener: () => void) => void;
	removeChangeListener?: (listener: () => void) => void;
};

export function subscribeToStore(
	store: ChangeListenerStore | null | undefined,
	listener: () => void,
): () => void {
	if (!store?.addChangeListener) return () => {};
	store.addChangeListener(listener);
	return () => store.removeChangeListener?.(listener);
}
