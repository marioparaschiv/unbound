import { useEffect, useReducer } from 'react';

/**
 * Creates a updateable react store with a remote api.
 * @param {Any} state Intitial State of your store
 */
export default function createStore<T = any>(state: T) {
	const listeners = new Set<(state: T) => void>();

	const API = Object.freeze({
		getState(factory: (state: T) => T = _ => _) {
			return factory(state);
		},

		setState(partial: T | ((state: T) => T)) {
			const partialState = typeof partial === 'function' ? (partial as ((state: T) => T))(state) : partial;
			if (Object.is(state, partialState)) return;

			state = Object.assign({}, state, partialState);

			// Schedule firing of listeners to avoid hanging sync functions that call setState.
			setImmediate(() => {
				for (const listener of listeners) {
					try {
						listener(state);
					} catch {
						console.error('Failed to fire listener in zustand store.');
					}
				}
			});
		},

		useState(factory: ((T) => T) = _ => _) {
			const [, forceUpdate] = useReducer(e => e + 1, 0);

			useEffect(() => {
				const handler = () => {
					forceUpdate();
				};

				listeners.add(handler);

				return () => void listeners.delete(handler);
			}, []);

			return API.getState(factory);
		},

		addListener(listener: (state: T) => void) {
			if (listeners.has(listener)) return;
			listeners.add(listener);

			return () => listeners.delete(listener);
		},

		removeListener(listener: (state: T) => void) {
			return listeners.delete(listener);
		},

		get listeners() {
			return listeners;
		}
	});

	return API;
}