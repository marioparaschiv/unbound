import { useSyncExternalStore } from 'react';

type FlagState = {
	running: boolean;
	listeners: Set<() => void>;
};

export type RunningFlag = {
	/** Marks the plugin running and returns the function that marks it stopped; pass it to `applyFeatures`. */
	markRunning: () => () => void;
	/** Reads whether the plugin is running, re-rendering when it starts or stops. */
	useRunning: () => boolean;
};

/**
 * @description Lets components a plugin injected hide themselves once it stops, without waiting for their parent to re-render.
 * @param pluginId The plugin's ID, which keys the state.
 * @returns The flag's setter and hook.
 */
export function createRunningFlag(pluginId: string): RunningFlag {
	// Every start evaluates the bundle again, so components still mounted from an earlier evaluation
	// read the state through a global key and come back when the plugin starts again.
	const host: Record<symbol, FlagState | undefined> = globalThis;
	const key = Symbol.for(`${pluginId}.enabled`);
	const state = (host[key] ??= { running: false, listeners: new Set() });

	function set(running: boolean) {
		state.running = running;

		for (const listener of state.listeners) listener();
	}

	function subscribe(listener: () => void) {
		state.listeners.add(listener);

		return () => void state.listeners.delete(listener);
	}

	return {
		markRunning() {
			set(true);

			return () => set(false);
		},
		useRunning: () => useSyncExternalStore(subscribe, () => state.running),
	};
}

export default createRunningFlag;
