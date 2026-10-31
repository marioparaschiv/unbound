import type { MetroModuleLoadListener } from '~/metro/types';

/** @internal */
export const blacklist = new Set<number>();

/** @internal */
export const data = {
	cache: new Map(),
	importingModuleId: -1,
	patchedNativeRequire: false,
	patchedRTNProfiler: false,
	patchedImportTracker: false,
	// Every Discord-authored module requires this one, which tracks file paths. -1 until it loads.
	importTrackerId: -1,
	origToString: Object.getOwnPropertyDescriptor(Function.prototype, 'toString')?.value,
	listeners: new Set<MetroModuleLoadListener>(),
};
