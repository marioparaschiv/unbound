import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { uwuToggle } from '~/lib/toggle';
import { uwuify } from '~/lib/uwuify';

type Message = { content: string };

function isMessage(argument: unknown): argument is Message {
	return (
		typeof argument === 'object' && typeof (argument as Partial<Message>)?.content === 'string'
	);
}

function uwuifyOutgoing({ args }: { args: unknown[] }) {
	const [channelId] = args;
	const message = args.find(isMessage);

	if (!message?.content || typeof channelId !== 'string') return;

	const active = uwuToggle.takeForSend(channelId, {
		persist: settings.persistState,
		autoDisable: settings.autoDisable,
	});

	if (active) message.content = uwuify(message.content, settings);
}

/**
 * @description Rewrites each message the user sends or edits into uwu speak while the toggle is on. Patches `sendMessage`
 * and `editMessage` on Discord's message actions, which both platforms share.
 */
export function patchMessageActions(): void {
	const Messages = metro.api.Messages;

	if (!Messages) {
		logger.warn('UwUifier skipped: Discord moved Messages.');

		return;
	}

	for (const method of ['sendMessage', 'editMessage'] as const) {
		if (typeof Messages[method] === 'function')
			patcher.before(Messages, method, uwuifyOutgoing);
	}
}
