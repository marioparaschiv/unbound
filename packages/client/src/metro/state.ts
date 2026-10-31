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
	origToString: Object.getOwnPropertyDescriptor(Function.prototype, 'toString')?.value,
	listeners: new Set<MetroModuleLoadListener>(),
};
