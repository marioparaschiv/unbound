import { spawn } from 'node:child_process';

import type { DiscoveredAddon } from '~/lib/discovery';

/**
 * @description Builds a single addon by running the config's `build` command with cwd set to the
 * addon directory. Static addons carry no build step, so they resolve immediately as successful.
 * stdout and stderr are inherited so the build's own output surfaces live.
 * @param addon The addon to build.
 * @param buildCommand The shell command to run in the addon directory.
 * @returns Whether the build succeeded (always `true` for static addons).
 */
export function buildAddon(addon: DiscoveredAddon, buildCommand: string): Promise<boolean> {
	if (addon.static) return Promise.resolve(true);

	return new Promise((resolve) => {
		const child = spawn(buildCommand, {
			cwd: addon.dir,
			shell: true,
			stdio: 'inherit',
		});

		child.on('error', () => resolve(false));
		child.on('close', (code) => resolve(code === 0));
	});
}

export default buildAddon;
