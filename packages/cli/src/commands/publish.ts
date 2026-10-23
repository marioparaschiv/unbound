import type { CommandDefinition, CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { ApiRequestError } from '@unbound-app/web/client';
import toError from '@unbound-app/utils/to-error';
import { z } from 'zod';

import type { DiscoveredAddon } from '~/lib/discovery';
import { discoverAddons } from '~/lib/discovery';
import { buildAddon } from '~/lib/build-addon';
import { loadConfig } from '~/lib/config';
import { publish } from '~/lib/publish';
import { parseEnv } from '~/lib/env';

const schema = z.object({
	addon: z
		.string()
		.optional()
		.describe('The id of the addon to publish; required when the workspace has several.'),
	skipBuild: z
		.boolean()
		.default(false)
		.describe('Publish the existing build output instead of building first.'),
	repository: z
		.string()
		.optional()
		.describe('The GitHub owner/name the addon is built from, to verify its source.'),
	changelog: z.string().optional().describe('What changed in this version.'),
});

const publishCommand: CommandDefinition<typeof schema> = {
	name: 'publish',
	description:
		'Build an addon and submit it for review on Unbound. Authenticates with UNBOUND_API_KEY when ' +
		'set, otherwise with the `ubd login` session.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler({ addon: id, skipBuild, repository, changelog }) {
		try {
			const env = parseEnv();
			const resolved = loadConfig();
			const addon = selectAddon(await discoverAddons(resolved), id);

			if (!skipBuild && !(await buildAddon(addon, resolved.config.build))) {
				return { ok: false, text: `Failed to build ${addon.id}.` };
			}

			const submission = await publish({ env, addon, repository, changelog });
			const source = submission.unverifiedSource ? ' (unverified source)' : '';

			return {
				ok: true,
				text: `Submitted ${submission.addonId} ${submission.version} as ${submission.kind} ${submission.id}${source}: ${submission.status}.`,
				data: submission,
			};
		} catch (error) {
			return toFailure(error);
		}
	},
};

function selectAddon(addons: DiscoveredAddon[], id: string | undefined): DiscoveredAddon {
	const ids = addons.map((addon) => addon.id).join(', ');

	if (id) {
		const found = addons.find((addon) => addon.id === id);

		if (!found) {
			throw new Error(`No addon ${id} in this workspace. Found: ${ids || 'none'}.`);
		}

		return found;
	}

	const [only] = addons;

	if (!only) {
		throw new Error('No addons found.');
	}

	if (addons.length > 1) {
		throw new Error(`Several addons found (${ids}); choose one with --addon.`);
	}

	return only;
}

// UNKNOWN: anything can be thrown.
function toFailure(error: unknown): CommandOutput {
	if (error instanceof ApiRequestError) {
		return { ok: false, text: `${error.message} (${error.code})` };
	}

	return { ok: false, text: toError(error).message };
}

export default publishCommand;
