import { formatDuration, killGroup, spawnGroup } from '~/lib/run-command';
import { buildWithReport, type ReportedBuild } from '~/lib/build-report';
import { buildChecks, runBuildChecks } from '~/lib/build-checks';
import type { Check, CheckCache } from '~/lib/check/check';
import type { DiscoveredAddon } from '~/lib/discovery';
import { buildEnv } from '~/rollup/build-env';

export type AddonBuildOptions = {
	/** The workspace's build command, run in the addon's directory. */
	command: string;
	/** Build for a running client to hot-reload: the preset compiles React Fast Refresh in. */
	hot?: boolean;
	/** Log each metro filter and locale hook the build rewrote. */
	verbose?: boolean;
	/** The checks to run after the bundle step; `ubd build`'s by default. */
	checks?: readonly Check[];
	/** The check caches to share across builds. */
	cache?: CheckCache;
	/** How long the bundle step may run before it fails; unbounded when omitted. */
	timeoutMs?: number;
	/** Have the preset write the build report and read it back; off by default, which keeps hot builds fast. */
	report?: boolean;
};

/**
 * @description Builds an addon, then runs the post-build checks and, when asked, reads the build report.
 * A static addon has no bundle step but still runs the checks; a failed bundle skips them.
 * @param addon The addon to build.
 * @param options The build command, how to build, the checks to run after it, and whether to report.
 * @returns Whether the bundle step succeeded and no check reported an error, and the build's report.
 */
export async function buildAddon(
	addon: DiscoveredAddon,
	options: AddonBuildOptions,
): Promise<ReportedBuild> {
	const {
		command,
		hot = false,
		verbose = false,
		checks = buildChecks(),
		cache,
		timeoutMs,
		report = false,
	} = options;
	const build = async (reportFile?: string) =>
		(await runBuildCommand(
			addon,
			command,
			buildEnv({ hot, verbose, reportFile }),
			timeoutMs,
		)) && (await runBuildChecks(addon, checks, cache));

	return report ? buildWithReport(addon, build) : { ok: await build(), report: void 0 };
}

/**
 * @description Runs the build command of a single addon with cwd set to the addon directory. Static addons carry no build step, so they resolve immediately as successful.
 * stdout and stderr are inherited so the build's own output surfaces live. The build runs in its own
 * process group, so a timeout kills every process it started, not just the shell.
 * @param addon The addon to build.
 * @param buildCommand The shell command to run in the addon directory.
 * @param env Variables added to the build's environment.
 * @param timeoutMs How long the build may run before it is killed and reported as failed; unbounded when omitted.
 * @returns Whether the build succeeded (always `true` for static addons).
 */
export function runBuildCommand(
	addon: DiscoveredAddon,
	buildCommand: string,
	env: Record<string, string> = {},
	timeoutMs?: number,
): Promise<boolean> {
	if (addon.static) {
		return Promise.resolve(true);
	}

	return new Promise((resolve) => {
		const child = spawnGroup(buildCommand, [], {
			cwd: addon.dir,
			env: { ...process.env, ...env },
			shell: true,
			stdio: ['ignore', 'inherit', 'inherit'],
		});

		const timer =
			timeoutMs === void 0
				? void 0
				: setTimeout(() => {
						process.stderr.write(
							`Building ${addon.id} timed out after ${formatDuration(timeoutMs)}.\n`,
						);
						killGroup(child);
					}, timeoutMs);

		function settle(ok: boolean) {
			clearTimeout(timer);
			resolve(ok);
		}

		child.on('error', () => settle(false));
		child.on('close', (code) => settle(code === 0));
	});
}

export default buildAddon;
