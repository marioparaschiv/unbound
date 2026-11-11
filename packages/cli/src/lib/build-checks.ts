import { capabilitiesCheck, declaredCapabilitiesCheck } from '~/lib/checks/capabilities';
import { createCheckCache, type Check, type CheckCache } from '~/lib/check/check';
import { formatReport, formatSummary, summarize } from '~/lib/check/report';
import { hasFailures, runChecks } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import { messagesCheck } from '~/lib/checks/messages';
import { layoutCheck } from '~/lib/checks/layout';
import { namingCheck } from '~/lib/checks/naming';
import { i18nCheck } from '~/lib/checks/i18n';
import { pageCheck } from '~/lib/checks/page';

export const DEV_BUILD_CHECKS: readonly Check[] = [declaredCapabilitiesCheck];

/**
 * @description The checks `ubd build` runs after the bundle step.
 * @param declaredCapabilities Keep the hand-written platforms and capabilities instead of generating them.
 * @returns The checks, in the order they run.
 */
export function buildChecks(declaredCapabilities = false): readonly Check[] {
	return [
		namingCheck,
		declaredCapabilities ? declaredCapabilitiesCheck : capabilitiesCheck,
		layoutCheck,
		pageCheck,
		i18nCheck,
		messagesCheck,
	];
}

/**
 * @description Runs the checks against an addon, writing what they derive into its output, and
 * prints every diagnostic on stderr in the format `ubd check` prints.
 * @param addon The addon to check.
 * @param checks The checks to run.
 * @param cache The caches to share with earlier and later runs, such as `ubd dev`'s rebuilds.
 * @returns Whether no check reported an error; warnings never fail.
 */
export async function runBuildChecks(
	addon: DiscoveredAddon,
	checks: readonly Check[] = buildChecks(),
	cache: CheckCache = createCheckCache(),
): Promise<boolean> {
	const result = await runChecks(addon, checks, { emit: true, cache });

	if (result.diagnostics.length) {
		process.stderr.write(
			`${formatReport([result], process.cwd())}\n${formatSummary(summarize([result]), 1)}\n`,
		);
	}

	return !hasFailures(result.diagnostics);
}

export default { DEV_BUILD_CHECKS, buildChecks, runBuildChecks };
