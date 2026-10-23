import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import type { UnboundGlobal } from '@unbound-app/api/global';
import { z } from 'zod';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode } from '~/lib/device';
import { waitForDevice } from '~/lib/context';
import { formatResult } from '~/lib/format';

/** The global the running bundle is tagged with, so the reloaded one can be told apart. */
const TOKEN_KEY = '__UBD_RELOAD__';

/** How often the reload command probes for the fresh bundle. */
const RELOAD_POLL_MS = 500;

const schema = z.object({
	timeout: z
		.number()
		.default(60_000)
		.describe('How long to wait for the reloaded app to reconnect, in milliseconds.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

// Runs on the device: tags the bundle, then reloads once the eval has answered.
function tagAndReload(unbound: UnboundGlobal, key: string, token: string): string {
	Reflect.set(globalThis, key, token);
	setTimeout(() => void unbound.native.reload(), 100);

	return 'reloading';
}

// Runs on the device: a fresh bundle no longer carries the token.
function bundleFreshness(_unbound: UnboundGlobal, key: string, token: string): string {
	return Reflect.get(globalThis, key) === token ? 'stale' : 'fresh';
}

const reloadCommand: CommandDefinition<typeof schema> = {
	name: 'reload',
	description:
		'Reload the JavaScript bundle on the connected device and wait until the fresh bundle ' +
		'reconnects to the debugger. The fresh bundle is told apart by a token the old one carried.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	async handler({ timeout }, { client }) {
		const token = crypto.randomUUID();
		const started = Date.now();
		const result = await evaluateOnDevice(client, toDeviceCode(tagAndReload, TOKEN_KEY, token));

		if (!result) {
			return NOT_CONNECTED;
		}

		if (!result.ok) {
			return { ok: false, text: formatResult(result) };
		}

		while (Date.now() - started < timeout) {
			await Bun.sleep(RELOAD_POLL_MS);
			await waitForDevice(client, RELOAD_POLL_MS);

			if (!client.isDeviceConnected) {
				continue;
			}

			const probe = await client.evaluate(toDeviceCode(bundleFreshness, TOKEN_KEY, token));

			if (probe.ok && probe.value === 'fresh') {
				return { ok: true, text: `Reloaded in ${Date.now() - started}ms.` };
			}
		}

		return { ok: false, text: `The app did not reconnect within ${timeout}ms of reloading.` };
	},
};

export default reloadCommand;
