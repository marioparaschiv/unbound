import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { devicePlatform, openDeviceTarget } from '~/lib/device-target';
import { installOnAndroid } from '~/lib/android-install';
import { readPluginPayload } from '~/lib/plugin-install';
import { resolveAddonTarget } from '~/lib/addon-target';
import { installOnIOS } from '~/lib/ios-install';
import { defaulted, Type } from '~/lib/schema';

const BUILD_TIMEOUT_MS = 300_000;

const schema = Type.Object({
	addon: defaulted(
		Type.String({ description: 'The plugin to install, as its manifest id or directory.' }),
		'.',
	),
	build: defaulted(Type.Boolean({ description: 'Build the plugin before installing it.' }), true),
	serial: Type.Optional(
		Type.String({
			description: 'The adb serial of the Android device, when several are attached.',
		}),
	),
	ios: defaulted(
		Type.Boolean({
			description: 'Install on a jailbroken iPhone through jb-p1lot instead of over adb.',
		}),
		false,
	),
	udid: Type.Optional(
		Type.String({
			description: 'The UDID of the iPhone, when several are connected. Implies --ios.',
		}),
	),
	restart: defaulted(
		Type.Boolean({ description: 'Restart Discord afterwards so it loads the plugin.' }),
		false,
	),
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
	async handler({ addon: addonTarget, build, serial, ios, udid, restart }) {
		const platform = devicePlatform({ serial, ios, udid });

		if (typeof platform !== 'string') {
			return { ok: false, text: platform.error };
		}

		const resolved = await resolveAddonTarget(addonTarget, build, BUILD_TIMEOUT_MS);

		if ('error' in resolved) {
			return { ok: false, text: resolved.error };
		}

		const plugin = readPluginPayload(resolved.addon);

		if ('error' in plugin) {
			return { ok: false, text: plugin.error };
		}

		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		return target.platform === 'ios'
			? installOnIOS(plugin, target, { restart })
			: installOnAndroid(plugin, target, { restart });
	},
};

export default installCommand;
