import type { Plugin } from 'rolldown';

/**
 * @description Resolves each module id to the file that stands in for it, so one build can swap a
 * module for a leaner twin without touching its importers.
 * @param modules The module id, mapped to the file that builds in its place.
 * @returns A rolldown plugin resolving those ids to their replacement.
 */
export default function releaseModules(modules: Record<string, string>): Plugin {
	return {
		name: 'release-modules',
		resolveId(id) {
			return modules[id] ?? null;
		},
	};
}
