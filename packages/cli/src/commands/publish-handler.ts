import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { ApiRequestError } from '@unbound-app/web/client';
import toError from '@unbound-app/utils/to-error';

import type { CommandHandler } from '~/lib/lazy-handler';
import type { DiscoveredAddon } from '~/lib/discovery';
import { discoverAddons } from '~/lib/discovery';
import { loadConfig } from '~/lib/config';
import { publish } from '~/lib/publish';
import { parseEnv } from '~/lib/env';

import type publishCommand from './publish';

const handler: CommandHandler<typeof publishCommand.schema> = async ({
	addon: id,
	ref,
	repository,
}) => {
	try {
		const env = parseEnv();
		const resolved = loadConfig();

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const addon = selectAddon(await discoverAddons(resolved), id);
		const submission = await publish({ env, addon, repository, ref });
		const { source } = submission;

		return {
			ok: true,
			text: `Submitted ${submission.addonId} ${submission.version} (${submission.kind}) from ${source.repository}@${source.commitSha.slice(0, 7)}: ${submission.status}.`,
			data: submission,
		};
	} catch (error) {
		return toFailure(error);
	}
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

export default handler;
