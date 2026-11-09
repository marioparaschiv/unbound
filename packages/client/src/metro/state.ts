import type { MetroModuleLoadListener } from '~/metro/types';

/** Ids of metro modules that threw while initialising; searches skip them. */
export const blacklist = new Set<number>();

/** Metro search's mutable internal state: the module cache, load listeners and which require hooks are installed. */
export const data = {
	cache: new Map(),
	importingModuleId: -1,
	patchedNativeRequire: false,
	patchedRTNProfiler: false,
	patchedImportTracker: false,
	// Every Discord-authored module requires this one, which tracks file paths. -1 until it loads.
	importTrackerId: -1,
	// The id of each module that reported its file path as it loaded, so a path lookup needs no scan.
	filePaths: new Map<string, number>(),
	origToString: Object.getOwnPropertyDescriptor(Function.prototype, 'toString')?.value,
	listeners: new Set<MetroModuleLoadListener>(),
	// Each module's id as its factory starts, so a search of loaded modules skips the ~20,000 that never loaded.
	initialized: [] as number[],
};

let sortedLoaded: number[] = [];

/**
 * @description Lists the modules whose factories have run, in id order, so a search of them matches the module a
 * scan of every id would.
 * @returns The loaded module ids, sorted.
 */
export function loadedIds(): readonly number[] {
	if (sortedLoaded.length !== data.initialized.length) {
		// Hermes has no `toSorted`.
		sortedLoaded = data.initialized.slice().sort((a, b) => a - b);
	}

	return sortedLoaded;
}
