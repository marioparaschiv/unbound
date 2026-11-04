import { capabilitiesCheck, declaredCapabilitiesCheck } from '~/lib/checks/capabilities';
import { formatReport, formatSummary, summarize } from '~/lib/check/report';
import { createCheckCache, type Check } from '~/lib/check/check';
import { hasFailures, runChecks } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import { messagesCheck } from '~/lib/checks/messages';
import { layoutCheck } from '~/lib/checks/layout';
import { namingCheck } from '~/lib/checks/naming';
import { buildAddon } from '~/lib/build-addon';
import { i18nCheck } from '~/lib/checks/i18n';
import { pageCheck } from '~/lib/checks/page';

export const BUILD_CHECKS: readonly Check[] = [
	namingCheck,
	capabilitiesCheck,
	layoutCheck,
	pageCheck,
	i18nCheck,
	messagesCheck,
];

export const DECLARED_CAPABILITY_CHECKS: readonly Check[] = [
	namingCheck,
	declaredCapabilitiesCheck,
	layoutCheck,
	pageCheck,
	i18nCheck,
	messagesCheck,
];

export const DEV_BUILD_CHECKS: readonly Check[] = [declaredCapabilitiesCheck];

// `ubd dev` re-runs the checks on every rebuild; unchanged files stay parsed between them.
const cache = createCheckCache();

/**
 * @description Runs the checks against an addon, writing what they derive into its output, and
 * prints every diagnostic on stderr in the format `ubd check` prints.
 * @param addon The addon to check.
 * @param checks The checks to run.
 * @returns Whether no check reported an error; warnings never fail.
 */
export async function runBuildChecks(
	addon: DiscoveredAddon,
	checks: readonly Check[] = BUILD_CHECKS,
): Promise<boolean> {
	const result = await runChecks(addon, checks, { emit: true, cache });

	if (result.diagnostics.length) {
		process.stderr.write(
			`${formatReport([result], process.cwd())}\n${formatSummary(summarize([result]), 1)}\n`,
		);
	}

	return !hasFailures(result.diagnostics);
}

/**
 * @description Builds an addon, then runs the post-build checks. A static addon has no bundle
 * step but still runs the checks; a failed bundle skips them.
 * @param addon The addon to build.
 * @param buildCommand The shell command to run in the addon directory.
 * @param checks The checks to run after the bundle step.
 * @param env Variables added to the bundle step's environment.
 * @returns Whether the bundle step succeeded and no check reported an error.
 */
export async function buildWithChecks(
	addon: DiscoveredAddon,
	buildCommand: string,
	checks: readonly Check[] = BUILD_CHECKS,
	env: Record<string, string> = {},
): Promise<boolean> {
	if (!(await buildAddon(addon, buildCommand, env))) {
		return false;
	}

	return runBuildChecks(addon, checks);
}

export default {
	BUILD_CHECKS,
	DECLARED_CAPABILITY_CHECKS,
	DEV_BUILD_CHECKS,
	runBuildChecks,
	buildWithChecks,
};
