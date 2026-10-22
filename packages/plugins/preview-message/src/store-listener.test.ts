import { expect, test } from 'bun:test';

import { subscribeToStore } from '@preview-message/store-listener';

test('unsubscribes from the captured store after the plugin clears its reference', () => {
	const listeners = new Set<() => void>();
	const listener = () => {};
	let store: {
		addChangeListener: (value: () => void) => void;
		removeChangeListener: (value: () => void) => void;
	} | null = {
		addChangeListener: (value) => listeners.add(value),
		removeChangeListener: (value) => listeners.delete(value),
	};
	const unsubscribe = subscribeToStore(store, listener);
	expect(listeners.has(listener)).toBe(true);
	store = null;
	unsubscribe();
	expect(listeners.has(listener)).toBe(false);
	expect(store).toBeNull();
});

test('treats unavailable stores as inert subscriptions', () => {
	expect(() => subscribeToStore(null, () => {})()).not.toThrow();
	expect(() => subscribeToStore({}, () => {})()).not.toThrow();
});
