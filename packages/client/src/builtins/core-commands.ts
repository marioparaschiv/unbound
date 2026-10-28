import { createCommands, option } from '~/api/commands';
import { Discord } from '~/api/metro/components';
import { findByProps } from '~/api/metro';
import { Util } from '~/api/metro/common';
import { Screens } from '~/lib/constants';
import debug from '~/builtins/debugger';
import { Messages } from '~/api/i18n';
import { reload } from '~/api/native';
import storage from '~/api/storage';

import formatCodeBlock from './format-code-block';

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
			description: 'Turn the WebSocket debugger on or off',
			execute() {
				const enabled = !Settings.get('debugger.enabled', false);

				Settings.set('debugger.enabled', enabled);

				// The debugger only listens for this setting while it runs, so drive it directly.
				if (enabled) {
					debug.start();
				} else {
					debug.stop();
				}

				return {
					ephemeral: true,
					content: `Debugger ${enabled ? 'enabled' : 'disabled'}.`,
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
