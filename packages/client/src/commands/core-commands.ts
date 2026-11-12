import { sendDebugReport } from '~/diagnostics/debug-report';
import { getSetting, setSetting } from '~/settings/unbound';
import { createCommands, option } from '~/commands/api';
import { findByProps } from '~/metro/lookups';
import { Discord } from '~/metro/components';
import { Screens } from '~/core/constants';
import debug from '~/debugger/builtin.dev';
import { getBucket } from '~/storage/api';
import { reload } from '~/native/native';
import { messages } from '~/i18n/api';
import { Util } from '~/metro/common';

import formatCodeBlock from './format-code-block';

const Commands = createCommands('unbound');
const Navigation = findByProps('getRootNavigationRef', { lazy: true });

/** Registers Unbound's own slash commands in the shared Unbound section. */
export function start() {
	Commands.register({
		eval: {
			description: 'UNBOUND_COMMAND_EVAL_DESC',
			options: {
				code: option.string({
					description: 'UNBOUND_COMMAND_EVAL_CODE_DESC',
					required: true,
				}),
				send: option.boolean({ description: 'UNBOUND_COMMAND_EVAL_SEND_DESC' }),
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
			description: 'UNBOUND_COMMAND_RELOAD_DESC',
			execute: () => void reload(),
		},
		debug: {
			description: 'UNBOUND_COMMAND_DEBUG_DESC',
			options: {
				message: option.string({
					description: 'UNBOUND_COMMAND_DEBUG_MESSAGE_DESC',
				}),
				log: option.boolean({ description: 'UNBOUND_COMMAND_DEBUG_LOG_DESC' }),
			},
			execute: ({ message, log }, context) =>
				sendDebugReport(context?.channel?.id, message, { log }),
		},
		recovery: {
			description: 'UNBOUND_COMMAND_RECOVERY_DESC',
			execute: () => confirmRecovery(),
		},
		plugins: {
			description: 'UNBOUND_COMMAND_PLUGINS_DESC',
			execute: () => openScreen(Screens.Plugins),
		},
		themes: {
			description: 'UNBOUND_COMMAND_THEMES_DESC',
			execute() {
				// The Design page opens on the tab it last showed; themes are tab 0.
				getBucket('design').set('tab', 0);
				openScreen(Screens.Design);
			},
		},
	});

	// The default bundle carries no debugger, so its command would have nothing to toggle.
	if (import.meta.env.DEV_TOOLS) {
		Commands.register({
			debugger: {
				description: 'UNBOUND_COMMAND_DEBUGGER_DESC',
				options: {
					address: option.string({
						description: 'UNBOUND_COMMAND_DEBUGGER_ADDRESS_DESC',
					}),
				},
				execute({ address }) {
					const enabled = address ? true : !getSetting('debugger.enabled');

					if (address) {
						setSetting('debugger.address', address.trim());
					}

					setSetting('debugger.enabled', enabled);

					// The debugger only listens for these settings while it runs, so restart it directly.
					debug.stop();

					if (enabled) {
						debug.start();
					}

					const target = getSetting('debugger.address') || 'the default address';

					return {
						ephemeral: true,
						content: enabled
							? `Debugger enabled, connecting to ${target}.`
							: 'Debugger disabled.',
					};
				},
			},
		});
	}
}

/** Removes Unbound's slash commands. */
export function stop() {
	Commands.unregisterAll();
}

function confirmRecovery() {
	const enabled = !getSetting('recovery');

	Discord.showConfirmModal({
		title: messages.UNBOUND_RECOVERY_MODE,
		content: `${messages.UNBOUND_RECOVERY_MODE_DESC} ${enabled ? 'Turn it on' : 'Turn it off'} and restart?`,
		confirmText: messages.UNBOUND_RESTART,
		cancelText: messages.UNBOUND_CANCEL,
		onConfirm() {
			setSetting('recovery', enabled);
			void reload();
		},
	});
}

function openScreen(screen: string) {
	Navigation?.getRootNavigationRef().navigate('settings', { screen });
}

export default { start, stop };
