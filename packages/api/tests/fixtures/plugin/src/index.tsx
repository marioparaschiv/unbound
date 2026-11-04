import type { PluginContext } from '@unbound-app/api/native';
import { flux, metro, toasts } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { format } from '@unbound-app/i18n';

import GreetingTitle from '~/components/greeting-title';

let stopListening: (() => void) | undefined;

/** The contexts `start` received, for a test to read. */
export const received: PluginContext[] = [];

/** Patches sending, registers `/star`, and greets when the setting is on. */
export function start(context: PluginContext) {
	received.push(context);

	const MessageActions = metro.findByProps('sendMessage');

	if (MessageActions) {
		patcher.before(MessageActions, 'sendMessage', ({ args }) => [`${args[0]} ⭐`]);
	}

	commands.register({
		star: {
			description: 'STAR_DESCRIPTION',
			options: { user: commands.option.user({ required: true }) },
			execute({ user }) {
				toasts.success('STARRED', { name: addon.name, user: user.username });

				return { ephemeral: true, content: format('STARS', { count: 1 }) };
			},
		},
	});

	stopListening = flux.onAction('MESSAGE_CREATE', () => logger.info('A message arrived.'));

	if (settings.greetOnStart) {
		toasts.show({
			title: GreetingTitle,
			content: format('GREETING_BODY', { name: addon.name }),
		});
	}
}

/** Undoes everything `start` did. */
export function stop() {
	patcher.unpatchAll();
	commands.unregisterAll();
	stopListening?.();
}
