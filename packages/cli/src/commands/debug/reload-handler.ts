import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode } from '~/lib/device';
import { evalFailure, failure } from '~/lib/command-error';
import type { DevicePrelude } from '~/lib/device-prelude';
import type { CommandHandler } from '~/lib/lazy-handler';
import { lowerForHermes } from '~/lib/hermes-code';
import { waitForDevice } from '~/lib/context';
import { formatResult } from '~/lib/format';

import type reloadCommand from './reload';

/** The global the running bundle is tagged with, so the reloaded one can be told apart. */
const TOKEN_KEY = '__UBD_RELOAD__';

const RELOAD_POLL_MS = 500;

// Runs on the device: tags the bundle, then reloads once the eval has answered.
function tagAndReload({ unbound }: DevicePrelude, key: string, token: string): string {
	Reflect.set(globalThis, key, token);
	setTimeout(() => void unbound.native.reload(), 100);

	return 'reloading';
}

// Runs on the device: a fresh bundle no longer carries the token.
function bundleFreshness(_device: DevicePrelude, key: string, token: string): string {
	return Reflect.get(globalThis, key) === token ? 'stale' : 'fresh';
}

const handler: CommandHandler<typeof reloadCommand.schema> = async ({ timeout }, { client }) => {
	const token = crypto.randomUUID();
	const started = Date.now();
	const result = await evaluateOnDevice(client, toDeviceCode(tagAndReload, TOKEN_KEY, token));

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return evalFailure(result, formatResult(result));
	}

	while (Date.now() - started < timeout) {
		await Bun.sleep(RELOAD_POLL_MS);
		await waitForDevice(client, RELOAD_POLL_MS);

		if (!client.isDeviceConnected) {
			continue;
		}

		const probe = await client.evaluate(
			lowerForHermes(toDeviceCode(bundleFreshness, TOKEN_KEY, token)),
		);

		if (probe.ok && probe.value === 'fresh') {
			return { ok: true, text: `Reloaded in ${Date.now() - started}ms.` };
		}
	}

	return failure('timeout', `The app did not reconnect within ${timeout}ms of reloading.`, {
		field: 'timeout',
	});
};

export default handler;
