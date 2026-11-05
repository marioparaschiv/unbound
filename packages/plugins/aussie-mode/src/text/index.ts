import { patcher } from '@unbound-app/api';

import { flipUpsideDown } from '~/text/flip';
import { Messages } from '~/text/modules';

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
 * @description Turns each message the user sends or edits upside down before Discord sends it.
 * Patches `sendMessage` and `editMessage` on Discord's message actions, which both platforms share.
 * The Addon scope removes the patches when the plugin stops.
 */
export function startUpsideDownText(): void {
	for (const method of ['sendMessage', 'editMessage'] as const) {
		if (typeof Messages[method] === 'function') patcher.before(Messages, method, flipOutgoing);
	}
}
