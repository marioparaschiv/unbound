import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { resolveAddonTarget } from '~/lib/addon-target';
import { readBuiltAddon } from '~/lib/reload-transport';
import { staleBuildReason } from '~/lib/stale-build';
import { waitForDevice } from '~/lib/context';
import { NOT_CONNECTED } from '~/lib/device';

const schema = z.object({
	addon: z.string().default('.').describe('The plugin to push, as its manifest id or directory.'),
	build: z.boolean().default(true).describe('Build the plugin before pushing it.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const pushCommand: CommandDefinition<typeof schema> = {
	name: 'push',
	description:
		'Build one plugin and hot-reload it in the running client on the connected device, installing ' +
		'it when the device does not have it yet. Use this to try a change on a specific device.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['addon'] },
	async handler({ addon: target, build }, { client }) {
		const startedAt = Date.now();
		const resolved = await resolveAddonTarget(target, build);

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

		const built = readBuiltAddon(resolved.addon);
		const result = await client.pushPlugin({ addonId: resolved.addon.id, ...built });
		const compiled = Object.keys(built.bytecode ?? {});
		const summary = compiled.length
			? `${built.bundle.length} bytes, bytecode ${compiled.join(', ')}`
			: `${built.bundle.length} bytes`;

		return result.ok
			? { ok: true, text: `Pushed ${resolved.addon.id} (${summary}).` }
			: { ok: false, text: `Pushing ${resolved.addon.id} failed: ${result.error}` };
	},
};

export default pushCommand;
