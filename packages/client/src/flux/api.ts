import type {
	FluxActionInterceptor,
	FluxActionListener,
	FluxChangeListener,
	GetStoreOptions,
	FluxActionType,
	FluxStoreName,
	FluxActionOf,
	FluxStoreOf,
	FluxAction,
	FluxStore,
} from '@unbound-app/types/flux';
import { createLogger } from '@unbound-app/logger';
import type { DependencyList } from 'react';

import { Dispatcher, FluxHooks } from '~/flux/modules';
import { finder } from '~/metro/finders';

export type * from '@unbound-app/types/flux';

type FluxDispatcher = {
	dispatch(action: FluxAction): Promise<void>;
	subscribe<K extends string>(type: K, listener: FluxActionListener<K>): void;
	unsubscribe<K extends string>(type: K, listener: FluxActionListener<K>): void;
	addInterceptor(interceptor: (action: FluxAction) => boolean): void;
};

const Logger = createLogger('Flux');
const dispatcher: FluxDispatcher = Dispatcher;

// Discord's dispatcher cannot remove an interceptor, so one is installed and it reads this registry.
const interceptors = new Map<string, Set<FluxActionInterceptor<string>>>();
let installed = false;

function intercept(action: FluxAction): boolean {
	const registered = interceptors.get(action.type);

	if (!registered) {
		return false;
	}

	for (const interceptor of registered) {
		try {
			if (interceptor(action) === true) {
				return true;
			}
		} catch (error) {
			Logger.error(`Failed to run a ${action.type} interceptor:`, error);
		}
	}

	return false;
}

/**
 * @description Finds one of Discord's Flux stores by name. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template K The store name, typed from {@link FluxStores}.
 * @param name The store name without its `Store` suffix, like `'User'`.
 * @param options Whether to search lazily, and whether to append `Store` to the name.
 * @returns The store, typed from {@link FluxStores}, else as a base {@link FluxStore}.
 */
export function getStore<K extends FluxStoreName>(
	name: K,
	options: GetStoreOptions = {},
): FluxStoreOf<K> {
	return finder('findStore')(name, { ...options, lazy: options.lazy ?? true });
}

/**
 * @description Reads state from Flux stores in a component, re-rendering when any of them changes.
 * @template T The value the getter returns.
 * @param stores The store, or stores, the getter reads.
 * @param getter Reads the value from the stores.
 * @param deps Values the getter closes over; a change re-runs it.
 * @returns The getter's latest value.
 */
export function useStore<T>(
	stores: FluxStore | FluxStore[],
	getter: () => T,
	deps?: DependencyList,
): T {
	return FluxHooks.useStateFromStores([stores].flat(), getter, deps);
}

/**
 * @description Runs a listener each time a Flux store changes.
 * @param store The store to watch.
 * @param listener Runs after each change.
 * @returns A function that removes the listener.
 */
export function onStoreChange(store: FluxStore, listener: FluxChangeListener): () => void {
	store.addChangeListener(listener);

	return () => store.removeChangeListener(listener);
}

/**
 * @description Runs a listener for each Flux action of one type, after Discord's stores handle it.
 * @template K The action type, typed from {@link FluxActions}.
 * @param type The action type, like `'MESSAGE_CREATE'`.
 * @param listener Runs with each action. An error it throws is logged.
 * @returns A function that removes the listener.
 */
export function onAction<K extends FluxActionType>(
	type: K,
	listener: FluxActionListener<K>,
): () => void {
	function subscription(action: FluxActionOf<K>) {
		try {
			listener(action);
		} catch (error) {
			Logger.error(`Failed to run a ${type} listener:`, error);
		}
	}

	dispatcher.subscribe(type, subscription);

	return () => dispatcher.unsubscribe(type, subscription);
}

/**
 * @description Runs an interceptor before Discord handles each Flux action of one type. It may change the action, or drop it by returning `true`.
 * @template K The action type, typed from {@link FluxActions}.
 * @param type The action type, like `'MESSAGE_CREATE'`.
 * @param interceptor Runs with each action. An error it throws is logged and the action goes on.
 * @returns A function that removes the interceptor.
 */
export function interceptAction<K extends FluxActionType>(
	type: K,
	interceptor: FluxActionInterceptor<K>,
): () => void {
	if (!installed) {
		dispatcher.addInterceptor(intercept);
		installed = true;
	}

	const registered = interceptors.get(type) ?? new Set();
	const entry = interceptor as FluxActionInterceptor<string>;

	registered.add(entry);
	interceptors.set(type, registered);

	return () => {
		registered.delete(entry);

		if (!registered.size && interceptors.get(type) === registered) {
			interceptors.delete(type);
		}
	};
}

/**
 * @description Sends a Flux action through Discord's dispatcher.
 * @template A The action, whose payload is checked against {@link FluxActions} for a known type.
 * @param action The action, with its `type` and payload.
 * @returns A promise that settles once Discord's stores handled the action.
 */
export function dispatch<A extends FluxAction>(action: A & FluxActionOf<A['type']>): Promise<void> {
	return dispatcher.dispatch(action);
}
