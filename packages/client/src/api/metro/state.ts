/** @internal */
export const blacklist = new Set<number>();

/** @internal */
export const data = {
	cache: new Map(),
	importingModuleId: -1,
	patchedNativeRequire: false,
	patchedRTNProfiler: false,
	patchedImportTracker: false,
	origToString: Function.prototype.toString,
	listeners: new Set<(mdl: any, id: string) => void>(),
};
