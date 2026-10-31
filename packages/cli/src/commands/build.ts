import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { BUILD_CHECKS, DECLARED_CAPABILITY_CHECKS, buildWithChecks } from '~/lib/build-checks';
import { discoverAddons } from '~/lib/discovery';
import { loadConfig } from '~/lib/config';

const schema = z.object({
	declaredCapabilities: z
		.boolean()
		.default(false)
		.describe(
			'Keep the hand-written platforms and Capabilities of plugins that still declare them, until they select platform code with native.definePlatform.',
		),
});

const buildCommand: CommandDefinition<typeof schema> = {
	name: 'build',
	description:
		'Build every addon in the workspace once, then run the post-build checks on each, reporting per-addon success and failure.',
	summary: 'Build every addon in the workspace.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler({ declaredCapabilities }) {
		const resolved = loadConfig();

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const addons = await discoverAddons(resolved);

		if (addons.length === 0) {
			return { ok: true, text: 'No addons found.' };
		}

		const checks = declaredCapabilities ? DECLARED_CAPABILITY_CHECKS : BUILD_CHECKS;
		const failed: string[] = [];

		for (const addon of addons) {
			process.stdout.write(
				addon.static ? `Checking ${addon.id} (static addon)…\n` : `Building ${addon.id}…\n`,
			);

			const ok = await buildWithChecks(addon, resolved.config.build, checks);

			if (ok) {
				process.stdout.write(`Built ${addon.id}.\n`);
			} else {
				failed.push(addon.id);
				process.stderr.write(`Failed to build ${addon.id}.\n`);
			}
		}

		if (failed.length > 0) {
			return { ok: false, text: `Failed to build: ${failed.join(', ')}.` };
		}

		return { ok: true, text: 'All addons built.' };
	},
};

export default buildCommand;
