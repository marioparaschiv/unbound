import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { installOnAndroid } from '~/lib/android-install';
import { readPluginPayload } from '~/lib/plugin-install';
import { resolveAddonTarget } from '~/lib/addon-target';
import { installOnIOS } from '~/lib/ios-install';

const BUILD_TIMEOUT_MS = 300_000;

const schema = z.object({
	addon: z
		.string()
		.default('.')
		.describe('The plugin to install, as its manifest id or directory.'),
	build: z.boolean().default(true).describe('Build the plugin before installing it.'),
	serial: z
		.string()
		.optional()
		.describe('The adb serial of the Android device, when several are attached.'),
	ios: z
		.boolean()
		.default(false)
		.describe('Install on a jailbroken iPhone through jb-p1lot instead of over adb.'),
	udid: z
		.string()
		.optional()
		.describe('The UDID of the iPhone, when several are connected. Implies --ios.'),
	restart: z
		.boolean()
		.default(false)
		.describe('Restart Discord afterwards so it loads the plugin.'),
});

const installCommand: CommandDefinition<typeof schema> = {
	name: 'install',
	description:
		"Build one plugin and copy it into Discord's plugin folder on a rooted Android device or " +
		'emulator over adb, or on a jailbroken iPhone through jb-p1lot, so the next cold start loads ' +
		'it. Pass `restart` to relaunch Discord right away. Use `push` to hot-reload instead.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['addon'] },
	async handler({ addon: target, build, serial, ios, udid, restart }) {
		const onIOS = ios || udid !== void 0;

		if (onIOS && serial !== void 0) {
			return {
				ok: false,
				text: 'Pass either --serial for an Android device or --ios/--udid for an iPhone, not both.',
			};
		}

		const resolved = await resolveAddonTarget(target, build, BUILD_TIMEOUT_MS);

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const plugin = readPluginPayload(resolved.addon);

		if ('error' in plugin) {
			return { ok: false, text: plugin.error };
		}

		return onIOS
			? installOnIOS(plugin, { udid, restart })
			: installOnAndroid(plugin, { serial, restart });
	},
};

export default installCommand;
