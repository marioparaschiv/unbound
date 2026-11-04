import { metro, patcher } from '@unbound-app/api';

import { flipUpsideDown } from '~/text/flip';

type Message = { content: string };

const Messages = metro.api.Messages;

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
 * @returns A function that removes the patches.
 */
export function startUpsideDownText(): () => void {
	const unpatches = (['sendMessage', 'editMessage'] as const)
		.filter((method) => typeof Messages[method] === 'function')
		.map((method) => patcher.before(Messages, method, flipOutgoing));

	return () => {
		for (const unpatch of unpatches) unpatch();
	};
}
