import { BundleInfo, getRuntimeProperties, reload } from '~/api/native';
import { CLIENT_VERSION, Screens, VERSION } from '~/lib/constants';
import { React, ReactNative, Util } from '~/api/metro/common';
import { createCommands, option } from '~/api/commands';
import { Discord } from '~/api/metro/components';
import { findByProps } from '~/api/metro';
import debug from '~/builtins/debugger';
import { Messages } from '~/api/i18n';
import storage from '~/api/storage';

import formatCodeBlock from './format-code-block';
import formatDebugInfo from './format-debug-info';

const Commands = createCommands('unbound');
const Settings = storage.getStore('unbound');
const Navigation = findByProps('getRootNavigationRef', { lazy: true });

/** Registers Unbound's own slash commands in the shared Unbound section. */
export function start() {
	Commands.register({
		eval: {
			description: 'Evaluate JavaScript and show the result',
			options: {
				code: option.string({ description: 'The code to evaluate', required: true }),
				send: option.boolean({ description: 'Send the result to the channel' }),
			},
			async execute({ code, send = false }) {
				// Await so a promise shows its resolved value.
				// oxlint-disable-next-line no-eval
				const result = await (0, eval)(code);
				const content = formatCodeBlock(Util.inspect(result));

				return send ? content : { ephemeral: true, content };
			},
		},
		reload: {
			description: 'Reload Discord',
			execute: () => void reload(),
		},
		debug: {
			description: 'Send your Unbound, Discord and device versions',
			execute: () => formatDebugInfo(readDebugInfo()),
		},
		debugger: {
			description: 'Turn the WebSocket debugger on or off, or connect it to an address',
			options: {
				address: option.string({
					description: 'The bridge address, such as 192.168.1.2:9090',
				}),
			},
			execute({ address }) {
				const enabled = address ? true : !Settings.get('debugger.enabled', false);

				if (address) {
					Settings.set('debugger.address', address.trim());
				}

				Settings.set('debugger.enabled', enabled);

				// The debugger only listens for these settings while it runs, so restart it directly.
				debug.stop();

				if (enabled) {
					debug.start();
				}

				const target = Settings.get('debugger.address', '') || 'the default address';

				return {
					ephemeral: true,
					content: enabled
						? `Debugger enabled, connecting to ${target}.`
						: 'Debugger disabled.',
				};
			},
		},
		recovery: {
			description: 'Turn recovery mode on or off and restart',
			execute: () => confirmRecovery(),
		},
		plugins: {
			description: 'Open the Unbound plugins settings',
			execute: () => openScreen(Screens.Plugins),
		},
		themes: {
			description: 'Open the Unbound themes settings',
			execute() {
				// The Design page opens on the tab it last showed; themes are tab 0.
				storage.set('design', 'tab', 0);
				openScreen(Screens.Design);
			},
		},
	});
}

/** Removes Unbound's slash commands. */
export function stop() {
	Commands.unregisterAll();
}

function readDebugInfo() {
	const platform = globalThis.NativePlatform;
	const { Platform } = ReactNative;
	const rn = Platform.constants.reactNativeVersion;
	const runtime = getRuntimeProperties();
	const system =
		Platform.OS === 'android'
			? `Android ${Platform.constants.Release} (SDK ${Platform.Version})`
			: `iOS ${Platform.Version}`;

	return {
		client: `v${CLIENT_VERSION} ${VERSION}`,
		loader: String(globalThis.UNBOUND_LOADER?.version ?? 'unknown'),
		discord: String(BundleInfo?.Version ?? 'unknown'),
		discordBuild: String(BundleInfo?.Build ?? 'unknown'),
		react: React.version,
		reactNative: rn ? `${rn.major}.${rn.minor}.${rn.patch}` : 'unknown',
		hermes: String(runtime['OSS Release Version'] ?? 'unknown'),
		bytecode: String(runtime['Bytecode Version'] ?? 'unknown'),
		system,
		device: platform?.device.getDeviceModel() ?? 'unknown',
	};
}

function confirmRecovery() {
	const enabled = !Settings.get('recovery', false);

	Discord.showConfirmModal({
		title: Messages.UNBOUND_RECOVERY_MODE,
		content: `${Messages.UNBOUND_RECOVERY_MODE_DESC} ${enabled ? 'Turn it on' : 'Turn it off'} and restart?`,
		confirmText: Messages.UNBOUND_RESTART,
		cancelText: Messages.UNBOUND_CANCEL,
		onConfirm() {
			Settings.set('recovery', enabled);
			void reload();
		},
	});
}

function openScreen(screen: string) {
	Navigation.getRootNavigationRef().navigate('settings', { screen });
}

export default { start, stop };
