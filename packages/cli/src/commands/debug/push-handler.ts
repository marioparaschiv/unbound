import type { CommandHandler } from '~/lib/lazy-handler';
import { resolveAddonTarget } from '~/lib/addon-target';
import { staleBuildReason } from '~/lib/stale-build';
import { pushBuiltAddon } from '~/lib/built-addon';
import { failure } from '~/lib/command-error';
import { waitForDevice } from '~/lib/context';
import { NOT_CONNECTED } from '~/lib/device';

import type pushCommand from './push';

const handler: CommandHandler<typeof pushCommand.schema> = async (
	{ addon: target, build },
	{ client },
) => {
	const startedAt = Date.now();
	const resolved = await resolveAddonTarget(target, { build, hot: true });

	if ('error' in resolved) {
		return failure(resolved.code ?? 'command-failed', resolved.error, { field: 'addon' });
	}

	const stale = staleBuildReason(resolved.addon, build ? startedAt : undefined);

	if (stale) {
		return failure('command-failed', `Not pushing ${resolved.addon.id}: ${stale}`);
	}

	await waitForDevice(client);

	if (!client.isDeviceConnected) {
		return NOT_CONNECTED;
	}

	const pushed = await pushBuiltAddon(client, resolved.addon);

	return pushed.ok
		? { ok: true, text: `Pushed ${resolved.addon.id} (${pushed.summary}).` }
		: failure(pushed.code, `Pushing ${resolved.addon.id} failed: ${pushed.error}`, {
				message: pushed.error,
			});
};

export default handler;
