import { formatDuration, killGroup, spawnGroup } from '~/lib/run-command';
import type { DiscoveredAddon } from '~/lib/discovery';

/**
 * @description Builds a single addon by running the config's `build` command with cwd set to the
 * addon directory. Static addons carry no build step, so they resolve immediately as successful.
 * stdout and stderr are inherited so the build's own output surfaces live. The build runs in its own
 * process group, so a timeout kills every process it started, not just the shell.
 * @param addon The addon to build.
 * @param buildCommand The shell command to run in the addon directory.
 * @param env Variables added to the build's environment.
 * @param timeoutMs How long the build may run before it is killed and reported as failed; unbounded when omitted.
 * @returns Whether the build succeeded (always `true` for static addons).
 */
export function buildAddon(
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
