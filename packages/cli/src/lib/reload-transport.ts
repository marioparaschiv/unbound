import type { ControllerClient } from '@unbound-app/debugger-protocol/controller';

import { pushBuiltAddon, type BuiltAddon } from '~/lib/built-addon';
import { waitForDevice } from '~/lib/context';

export type ReloadClient = Pick<ControllerClient, 'isDeviceConnected' | 'pushPlugin'>;

export type ReloadContext = { client: ReloadClient };

/** How `ubd dev` pushes a freshly built addon to the running client. */
export type ReloadTransport = {
	reload(addon: BuiltAddon): Promise<void>;
};

/**
 * How long the watcher waits for a dropped device to reconnect before dropping a reload. Longer than
 * a one-shot command's poll, since a backgrounded app or slept device can take seconds to redial.
 */
const RECONNECT_WAIT_MS = 5_000;

/**
 * @description Builds the real hot-reload transport over the shared bridge controller. Each reload
 * pushes the freshly built addon with {@link pushBuiltAddon}. If the device isn't connected it waits
 * briefly for a reconnect, then warns and drops the reload; any disk or transport failure is reported.
 * Nothing here throws, so the watcher keeps running.
 * @param context A bearer of the bridge client shared by every command; its client dials on first use.
 * @param reconnectWaitMs How long to wait for a dropped device to reconnect before dropping a reload.
 * @returns A {@link ReloadTransport} bound to that context.
 */
export function createReloadTransport(
	context: ReloadContext,
	reconnectWaitMs: number = RECONNECT_WAIT_MS,
): ReloadTransport {
	return {
		async reload(addon: BuiltAddon): Promise<void> {
			const { client } = context;

			// The device dials the bridge; a momentary drop (backgrounded app, slept device) shouldn't
			// force a restart, so wait out a bounded window for it to come back before giving up.
			if (!client.isDeviceConnected) {
				await waitForDevice(client, reconnectWaitMs);
			}

			if (!client.isDeviceConnected) {
				process.stderr.write(
					`Device not connected — skipping reload of ${addon.id}; save again once reconnected.\n`,
				);

				return;
			}

			process.stdout.write(`Pushing ${addon.id}…\n`);

			// A missing build output or unreadable manifest comes back as an error, so the watcher keeps running.
			const pushed = await pushBuiltAddon(client, addon);

			if (pushed.ok) {
				process.stdout.write(`Reloaded ${addon.id}.\n`);
			} else {
				process.stderr.write(`Failed to reload ${addon.id}: ${pushed.error}\n`);
			}
		},
	};
}

export default createReloadTransport;
