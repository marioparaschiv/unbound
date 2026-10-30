import type { ImportRef, ModuleFacts } from './types';

/** How many re-exports, interop defaults and statics a lookup follows before it gives up on a cycle. */
export const MAX_HOPS = 16;

/** Where each module's re-exported names point, keyed by `exportKey`. */
export type ReExportIndex = ReadonlyMap<string, ImportRef>;

/**
 * @description Keys an export of a module for the export indexes.
 * @param moduleId The exporting module.
 * @param name The export's name.
 * @returns `<moduleId>:<name>`.
 */
export function exportKey(moduleId: number, name: string): string {
	return `${moduleId}:${name}`;
}

/**
 * @description Indexes every module's re-exports, so a lookup can follow a name to the module defining it.
 * @param facts The extracted modules.
 * @returns The target of each re-exported name.
 */
export function indexReExports(facts: ModuleFacts[]): ReExportIndex {
	const reExports = new Map<string, ImportRef>();

	for (const module of facts) {
		for (const { exportName, target } of module.reExports) {
			reExports.set(exportKey(module.moduleId, exportName), target);
		}
	}

	return reExports;
}

export default { MAX_HOPS, exportKey, indexReExports };
