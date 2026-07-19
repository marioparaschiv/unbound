import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';
import { loadConfig } from '~/lib/config';

const schema = z.object({});

const buildCommand: CommandDefinition<typeof schema> = {
	name: 'build',
	description:
		'Build every addon in the workspace once, reporting per-addon success and failure.',
	surfaces: { cli: true, mcp: false },
	schema,
	async handler() {
		const resolved = loadConfig();
		const addons = await discoverAddons(resolved);

		if (addons.length === 0) {
			return { ok: true, text: 'No addons found.' };
		}

		const failed: string[] = [];

		for (const addon of addons) {
			if (addon.static) {
				process.stdout.write(`Skipping ${addon.id} (static addon).\n`);
				continue;
			}

			process.stdout.write(`Building ${addon.id}…\n`);

			const ok = await buildAddon(addon, resolved.config.build);

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
