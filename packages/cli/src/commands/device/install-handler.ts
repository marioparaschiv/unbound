import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { devicePlatform, openDeviceTarget } from '~/lib/device-target';
import { installOnAndroid } from '~/lib/android-install';
import type { CommandHandler } from '~/lib/lazy-handler';
import { readPluginPayload } from '~/lib/plugin-install';
import { resolveAddonTarget } from '~/lib/addon-target';
import { installOnIOS } from '~/lib/ios-install';
import { failure } from '~/lib/command-error';

import type installCommand from './install';

const BUILD_TIMEOUT_MS = 300_000;

const handler: CommandHandler<typeof installCommand.schema> = async ({
	addon: addonTarget,
	build,
	serial,
	ios,
	udid,
	restart,
}) => {
	const platform = devicePlatform({ serial, ios, udid });

	if (typeof platform !== 'string') {
		return failure(platform.code, platform.error);
	}

	const resolved = await resolveAddonTarget(addonTarget, {
		build,
		timeoutMs: BUILD_TIMEOUT_MS,
	});

	if ('error' in resolved) {
		return failure(resolved.code ?? 'command-failed', resolved.error, { field: 'addon' });
	}

	const staging = mkdtempSync(join(tmpdir(), 'ubd-install-'));

	try {
		const plugin = readPluginPayload(resolved.addon, staging);

		if ('error' in plugin) {
			return { ok: false, text: plugin.error };
		}

		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return failure(target.code, target.error);
		}

		return await (target.platform === 'ios'
			? installOnIOS(plugin, target, { restart })
			: installOnAndroid(plugin, target, { restart }));
	} finally {
		rmSync(staging, { recursive: true, force: true });
	}
};

export default handler;
