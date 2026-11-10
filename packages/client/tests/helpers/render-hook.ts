import type { DependencyList } from 'react';

type Effect = () => (() => void) | void;

type Subscribe = (notify: () => void) => () => void;

type Rendered<T> = {
	/** The value the hook returned on its latest render. */
	readonly current: T;
	/** How many times the hook has rendered, the first render included. */
	readonly renders: number;
	/** Runs every effect cleanup and stops re-rendering. */
	unmount: () => void;
};

/** One mounted hook: its hook slots by call order, the effects its last render queued, and what unmounting it cleans up. */
type Instance = {
	slots: unknown[];
	index: number;
	mounted: boolean;
	pending: (() => void)[];
	cleanups: (() => void)[];
	render: () => void;
};

type EffectSlot = {
	ran: boolean;
	deps: DependencyList | undefined;
	cleanup: (() => void) | undefined;
};

type ExternalStore = {
	subscribed?: Subscribe;
	unsubscribe?: () => void;
	// UNKNOWN: one store slot holds any hook's snapshot, which it only compares by identity.
	getSnapshot: () => unknown;
	value: unknown;
};

function sameDeps(previous: DependencyList | undefined, next: DependencyList | undefined) {
	return Boolean(
		previous &&
		next &&
		previous.length === next.length &&
		previous.every((dep, index) => Object.is(dep, next[index])),
	);
}

/**
 * @description Creates a React whose hooks keep their state across renders, and re-render their hook synchronously when that state changes.
 * @returns The module to mock `react` with, and `renderHook` to mount a hook under it.
 */
export function createHookRenderer() {
	let rendering: Instance | undefined;

	function slot<T>(create: (instance: Instance) => T): [T, Instance] {
		const instance = rendering;

		if (!instance) {
			throw new Error('A hook ran outside renderHook.');
		}

		if (instance.index >= instance.slots.length) {
			instance.slots.push(create(instance));
		}

		return [instance.slots[instance.index++] as T, instance];
	}

	function rerender(instance: Instance) {
		if (instance.mounted) {
			instance.render();
		}
	}

	function useRef<T>(initial: T) {
		return slot(() => ({ current: initial }))[0];
	}

	// Like React's: a function initial value is called once, and a function update gets the current value.
	function useState<T>(initial: T | (() => T)) {
		const [state, instance] = slot(() => ({
			value: initial instanceof Function ? initial() : initial,
		}));

		function setState(update: T | ((current: T) => T)) {
			const next = update instanceof Function ? update(state.value) : update;

			if (Object.is(state.value, next)) return;

			state.value = next;
			rerender(instance);
		}

		return [state.value, setState] as const;
	}

	// Enough of React's for the dispatch-only reducers the hooks under test use, such as a forced re-render.
	function useReducer<S>(reducer: (current: S) => S, initial: S) {
		const [state, setState] = useState(initial);

		return [state, () => setState((current) => reducer(current))] as const;
	}

	function useCallback<T>(callback: T, deps: DependencyList) {
		const [memo] = slot(() => ({ callback, deps }));

		if (!sameDeps(memo.deps, deps)) {
			memo.callback = callback;
			memo.deps = deps;
		}

		return memo.callback;
	}

	// Effects run after the render, as React commits them: on mount, then again when a listed dep changes.
	// Without deps they run on mount only, which is all the subscribing hooks under test need.
	function useEffect(effect: Effect, deps?: DependencyList) {
		const [entry, instance] = slot((owner) => {
			const created: EffectSlot = { ran: false, deps: undefined, cleanup: undefined };

			owner.cleanups.push(() => created.cleanup?.());

			return created;
		});

		if (entry.ran && (deps === undefined || sameDeps(entry.deps, deps))) return;

		entry.ran = true;
		entry.deps = deps;
		instance.pending.push(() => {
			entry.cleanup?.();
			entry.cleanup = effect() || undefined;
		});
	}

	// Like React's, it re-renders when a notification changes the snapshot's identity, and resubscribes when `subscribe` does.
	function useSyncExternalStore<T>(subscribe: Subscribe, getSnapshot: () => T): T {
		const [store, instance] = slot<ExternalStore>(({ cleanups }) => {
			const created: ExternalStore = { getSnapshot, value: undefined };

			cleanups.push(() => created.unsubscribe?.());

			return created;
		});

		store.getSnapshot = getSnapshot;
		store.value = getSnapshot();

		if (store.subscribed !== subscribe) {
			store.unsubscribe?.();
			store.subscribed = subscribe;
			store.unsubscribe = subscribe(() => {
				if (!Object.is(store.getSnapshot(), store.value)) {
					rerender(instance);
				}
			});
		}

		return store.value as T;
	}

	/**
	 * @description Mounts a hook, rendering it again each time its state or a store it reads changes.
	 * @template T The value the hook returns.
	 * @param hook The hook, called with no arguments.
	 * @returns The latest value and the render count.
	 */
	function renderHook<T>(hook: () => T): Rendered<T> {
		let current = undefined as T;
		let renders = 0;

		const instance: Instance = {
			slots: [],
			index: 0,
			mounted: true,
			pending: [],
			cleanups: [],
			render() {
				const outer = rendering;

				rendering = instance;
				instance.index = 0;
				renders++;

				try {
					current = hook();
				} finally {
					rendering = outer;
				}

				for (const effect of instance.pending.splice(0)) effect();
			},
		};

		instance.render();

		return {
			get current() {
				return current;
			},
			get renders() {
				return renders;
			},
			unmount() {
				instance.mounted = false;

				for (const cleanup of instance.cleanups.splice(0)) cleanup();
			},
		};
	}

	const React = { useRef, useState, useReducer, useCallback, useEffect, useSyncExternalStore };

	return { React: { ...React, default: React }, renderHook };
}
