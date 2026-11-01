import type { MetroFilter } from '~/metro/filters';
import { data } from '~/metro/state';

// How far from a hint to look, either way. Ids moved by at most 5 between the builds measured.
const SPAN = 16;

// Each hint that led to a match, and how far its module moved. Modules move in blocks, so a neighbour's move predicts another's.
const moves: [hint: number, delta: number][] = [];

/**
 * @description Tests whether a module only registers an image, from its dependencies, so it is never loaded to be searched.
 * @param mdl The module record, before it initializes; Metro clears its dependencies once it has.
 * @returns `true` if the module's one dependency is the asset registry.
 */
export function isAssetModule(mdl: MetroModuleRecord | undefined): boolean {
	const deps = mdl?.dependencyMap;

	if (!mdl || mdl.isInitialized || deps?.length !== 1) {
		return false;
	}

	return typeof window.modules.get(deps[0])?.publicModule.exports?.registerAsset === 'function';
}

/**
 * @description Decides from a module's dependencies alone whether a filter could match it, so a forcing scan skips it unloaded.
 * @param mdl The module record, before it initializes.
 * @param filter The filter the scan searches by.
 * @returns `false` for an asset module, and for a module with no file path when the filter matches by path.
 */
export function couldMatch(mdl: MetroModuleRecord, filter: MetroFilter): boolean {
	const deps = mdl.dependencyMap;

	if (!deps) {
		return true;
	}

	if (filter.filePath !== void 0 && data.importTrackerId !== -1) {
		return deps.includes(data.importTrackerId);
	}

	return !isAssetModule(mdl);
}

/**
 * @description Lists the ids to try for a module an earlier Discord build had at `hint`, most likely first.
 * @param hint The module's id in the earlier build.
 * @returns The ids the nearest known moves predict, then `hint`, then the ids around it, all present in the registry.
 */
export function idsNear(hint: number): number[] {
	const ids = new Set<number>();
	const nearest = [...moves].sort((a, b) => Math.abs(a[0] - hint) - Math.abs(b[0] - hint));

	for (const [, delta] of nearest.slice(0, 3)) {
		ids.add(hint + delta);
	}

	ids.add(hint);

	for (let distance = 1; distance <= SPAN; distance++) {
		ids.add(hint + distance);
		ids.add(hint - distance);
	}

	return [...ids].filter((id) => window.modules.has(id));
}

/**
 * @description Records where a hinted module was found, so later lookups try the same move first.
 * @param hint The module's id in the earlier build.
 * @param id The module's id in this build.
 */
export function recordMove(hint: number, id: number) {
	moves.push([hint, id - hint]);
}

export default { isAssetModule, couldMatch, idsNear, recordMove };
