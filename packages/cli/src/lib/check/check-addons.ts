import { keepSelected, type CheckSelection } from '~/lib/check/registry';
import { runChecks, type AddonDiagnostics } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { CheckCache } from '~/lib/check/check';
import { mapInParallel } from '~/lib/parallel';

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
	return mapInParallel(addons, async (addon) => {
		const result = await runChecks(addon, selection.checks, { emit: false, cache });

		return { addon, diagnostics: keepSelected(selection, result.diagnostics) };
	});
}

export default checkAddons;
