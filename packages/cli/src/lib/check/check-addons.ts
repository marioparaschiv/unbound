import { availableParallelism } from 'node:os';

import { keepSelected, type CheckSelection } from '~/lib/check/registry';
import { runChecks, type AddonDiagnostics } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { CheckCache } from '~/lib/check/check';

/**
 * @description Checks addons without writing anything, a few at a time so `--all` does not start
 * every addon's oxlint and rollup at once.
 * @param addons The addons to check.
 * @param selection The checks to run and the ids to keep.
 * @param cache The caches to share with earlier and later runs.
 * @returns Each addon's kept diagnostics, in the order of `addons`.
 */
export async function checkAddons(
	addons: readonly DiscoveredAddon[],
	selection: CheckSelection,
	cache: CheckCache,
): Promise<AddonDiagnostics[]> {
	const results: AddonDiagnostics[] = [];
	const queue = addons.map((addon, index) => ({ addon, index }));

	async function work() {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const result = await runChecks(next.addon, selection.checks, { emit: false, cache });

			results[next.index] = {
				addon: next.addon,
				diagnostics: keepSelected(selection, result.diagnostics),
			};
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(addons.length, availableParallelism()) }, work),
	);

	return results;
}

export default checkAddons;
