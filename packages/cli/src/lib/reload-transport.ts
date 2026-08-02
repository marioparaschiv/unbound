import type { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import type { AddonManifest } from '@unbound-app/types';
import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

import { waitForDevice } from '~/lib/context';

export type ReloadClient = Pick<ControllerClient, 'isDeviceConnected' | 'pushPlugin'>;

export type ReloadContext = { client: ReloadClient };

export type BuiltAddon = {
	id: string;
	kind: 'plugin' | 'theme';
	dir: string;
	/** The resolved output path; the addon directory itself for static addons. */
	output: string;
	/** A static addon ships its files as-is; its bundle is read straight from `output`. */
	static: boolean;
};

/** How `ubd dev` pushes a freshly built addon to the running client. */
export interface ReloadTransport {
	reload(addon: BuiltAddon): Promise<void>;
}

type ReadAddon = { manifest: AddonManifest; bundle: string };

/**
 * How long the watcher waits for a dropped device to reconnect before warning and dropping a reload.
 * Longer than a one-shot command's poll (`DEVICE_WAIT_TIMEOUT_MS`): a `ubd dev` session runs for
 * hours, and a backgrounded app or slept device can take a few seconds to redial the bridge.
 */
const RECONNECT_WAIT_MS = 5_000;

/**
 * @description Builds the real hot-reload transport over the shared bridge controller. Each reload
 * reads the freshly built bundle and manifest from disk and pushes them to the device via
 * {@link ControllerClient.pushPlugin}. Theme hot reload isn't wired yet, so a theme is skipped with a
 * notice. If the device isn't connected it waits briefly for a reconnect, then warns and drops the
 * reload; any disk or transport failure is reported. Nothing here throws, so the watcher keeps running.
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
			// Theme reload has no device transport yet (tracked separately); rebuilding still writes the
			// output, so the developer just restarts to pick a theme up.
			if (addon.kind !== 'plugin') {
				process.stdout.write(
					`Rebuilt ${addon.id}, but ${addon.kind} hot reload isn't available yet — restart the app to load it.\n`,
				);
				return;
			}

			const { client } = context;

			// The device dials the bridge; a momentary drop (backgrounded app, slept device) shouldn't
			// force a restart, so wait out a bounded window for it to come back before giving up.
			if (!client.isDeviceConnected) await waitForDevice(client, reconnectWaitMs);

			if (!client.isDeviceConnected) {
				process.stderr.write(
					`Device not connected — skipping reload of ${addon.id}; save again once reconnected.\n`,
				);
				return;
			}

			try {
				const { manifest, bundle } = readBuiltAddon(addon);

				process.stdout.write(`Pushing ${addon.id}…\n`);

				const result = await client.pushPlugin({ addonId: addon.id, bundle, manifest });

				if (result.ok) {
					process.stdout.write(`Reloaded ${addon.id}.\n`);
				} else {
					process.stderr.write(`Failed to reload ${addon.id}: ${result.error}\n`);
				}
			} catch (error: any) {
				// A missing build output or unreadable manifest must not kill the watcher — report and drop.
				process.stderr.write(`Failed to reload ${addon.id}: ${error?.message ?? error}\n`);
			}
		},
	};
}

/**
 * @description Reads a built addon's manifest and bundle off disk. A static addon ships its files
 * as-is, so its bundle is the file named by `main` in its directory; a built addon's bundle is the
 * JavaScript the build emitted into the output directory, named after `main` with a `.js` extension.
 * @param addon The freshly built addon.
 * @returns The parsed manifest and the bundle source.
 */
function readBuiltAddon(addon: BuiltAddon): ReadAddon {
	const manifest: AddonManifest = JSON.parse(
		readFileSync(join(addon.dir, 'manifest.json'), 'utf8'),
	);

	const bundleName = addon.static
		? manifest.main
		: basename(manifest.main).replace(/\.\w+$/, '.js');
	const bundlePath = join(addon.output, bundleName);

	// Hot reload assumes the build emits `<main-basename>.js` into `output`; a differently-named
	// entry would otherwise surface as a bare ENOENT.
	if (!existsSync(bundlePath)) {
		throw new Error(
			`Built bundle not found at ${bundlePath}. Hot reload expects the build to emit ${bundleName} into ${addon.output}.`,
		);
	}

	const bundle = readFileSync(bundlePath, 'utf8');

	return { manifest, bundle };
}

export default createReloadTransport;
