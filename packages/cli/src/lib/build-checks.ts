import type { DiscoveredAddon } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';

export type BuildCheckIssue = {
	severity: 'error' | 'warning';
	message: string;
};

export type BuildCheck = {
	name: string;
	run: (addon: DiscoveredAddon) => BuildCheckIssue[] | Promise<BuildCheckIssue[]>;
};

export const BUILD_CHECKS: readonly BuildCheck[] = [];

/**
 * @description Runs each check against an addon in order and prints every issue, scoped to the addon.
 * @param addon The addon to check.
 * @param checks The checks to run, in order.
 * @returns Whether no check reported an error; warnings never fail.
 */
export async function runBuildChecks(
	addon: DiscoveredAddon,
	checks: readonly BuildCheck[] = BUILD_CHECKS,
): Promise<boolean> {
	let ok = true;

	for (const check of checks) {
		for (const issue of await collectIssues(check, addon)) {
			process.stderr.write(
				`${addon.id}: ${issue.severity} [${check.name}] ${issue.message}\n`,
			);

			if (issue.severity === 'error') {
				ok = false;
			}
		}
	}

	return ok;
}

/**
 * @description Builds an addon, then runs the post-build checks. A static addon has no bundle
 * step but still runs the checks; a failed bundle skips them.
 * @param addon The addon to build.
 * @param buildCommand The shell command to run in the addon directory.
 * @param checks The checks to run after the bundle step, in order.
 * @returns Whether the bundle step succeeded and no check reported an error.
 */
export async function buildWithChecks(
	addon: DiscoveredAddon,
	buildCommand: string,
	checks: readonly BuildCheck[] = BUILD_CHECKS,
): Promise<boolean> {
	if (!(await buildAddon(addon, buildCommand))) {
		return false;
	}

	return runBuildChecks(addon, checks);
}

async function collectIssues(
	check: BuildCheck,
	addon: DiscoveredAddon,
): Promise<BuildCheckIssue[]> {
	try {
		return await check.run(addon);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return [{ severity: 'error', message: `The check crashed: ${message}` }];
	}
}

export default { BUILD_CHECKS, runBuildChecks, buildWithChecks };
