import type { SelfTestResult } from '@unbound-plugins/shared/lifecycle/health';

export type LoadStatus = {
	markLoaded: (name: string) => () => void;
	pending: () => string[];
};

/**
 * @description Tracks which of the modules a plugin patches have loaded and been patched, since they load only when Discord first needs them.
 * @param names The modules' names, in the order to report them.
 * @returns A setter that marks a module patched and returns the function that unmarks it, and a reader for the modules not patched yet.
 */
export function createLoadStatus(names: string[]): LoadStatus {
	const loaded = new Set<string>();

	return {
		markLoaded(name) {
			loaded.add(name);

			return () => void loaded.delete(name);
		},
		pending: () => names.filter((name) => !loaded.has(name)),
	};
}

/**
 * @description Reports the plugin as working only once every module it patches has loaded and been patched.
 * @param features The result of the shared feature self-test.
 * @param pending The modules not patched yet.
 * @returns `features` when it failed or nothing is pending, otherwise a failure naming what to open first.
 */
export function loadSelfTest(features: SelfTestResult, pending: string[]): SelfTestResult {
	if (!features.ok || !pending.length) return features;

	return {
		ok: false,
		detail: `not patched yet, open a YouTube video in the media viewer first: ${pending.join(', ')}`,
		nothingDrawn: true,
	};
}
