import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { bridgePortField, waitForDevice } from '~/lib/context';
import { resolveAddonTarget } from '~/lib/addon-target';
import { staleBuildReason } from '~/lib/stale-build';
import { pushBuiltAddon } from '~/lib/built-addon';
import { defaulted, Type } from '~/lib/schema';
import { NOT_CONNECTED } from '~/lib/device';

const schema = Type.Object({
	addon: defaulted(
		Type.String({
			description: 'The plugin or theme to push, as its manifest id or directory.',
		}),
		'.',
	),
	build: defaulted(Type.Boolean({ description: 'Build the addon before pushing it.' }), true),
	port: bridgePortField,
});

const pushCommand: CommandDefinition<typeof schema> = {
	name: 'push',
	description:
		'Build one plugin or theme and hot-reload it in the running client on the connected device, installing ' +
		'it when the device does not have it yet. Use this to try a change on a specific device.',
	summary: 'Build an addon and hot-reload it on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['addon'] },
	async handler({ addon: target, build }, { client }) {
		const startedAt = Date.now();
		const resolved = await resolveAddonTarget(target, { build, hot: true });

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const stale = staleBuildReason(resolved.addon, build ? startedAt : undefined);

		if (stale) {
			return { ok: false, text: `Not pushing ${resolved.addon.id}: ${stale}` };
		}

		await waitForDevice(client);

		if (!client.isDeviceConnected) {
			return NOT_CONNECTED;
		}

		const pushed = await pushBuiltAddon(client, resolved.addon);

		return pushed.ok
			? { ok: true, text: `Pushed ${resolved.addon.id} (${pushed.summary}).` }
			: { ok: false, text: `Pushing ${resolved.addon.id} failed: ${pushed.error}` };
	},
};

export default pushCommand;
