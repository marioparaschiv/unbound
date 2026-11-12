import { metro, patcher } from '@unbound-app/api';

import { flipUpsideDown } from '~/lib/flip';
import { isAussieDevice } from '~/lib/locale';

type Message = { content: string };

function isMessage(argument: unknown): argument is Message {
	return (
		typeof argument === 'object' && typeof (argument as Partial<Message>)?.content === 'string'
	);
}

function flipOutgoing({ args }: { args: unknown[] }) {
	const message = args.find(isMessage);

	if (message?.content) {
		message.content = flipUpsideDown(message.content);
	}
}

/**
 * @description Turns each message the user sends or edits upside down before Discord sends it, on an Australian device.
 * Patches `sendMessage` and `editMessage` on Discord's message actions, which both platforms share.
 */
export function patchMessageActions(): void {
	if (!isAussieDevice()) return;

	const Messages = metro.api.Messages;

	if (!Messages) {
		logger.warn('Upside-down text skipped: Discord moved its message actions.');

		return;
	}

	for (const method of ['sendMessage', 'editMessage'] as const) {
		if (typeof Messages[method] === 'function') patcher.before(Messages, method, flipOutgoing);
	}
}
