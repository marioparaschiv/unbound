import { metro, patcher } from '@unbound-app/api';

import { translate } from '~/translation/translator';

type Message = { content: string };

const Messages = metro.api.Messages;

let patched = false;

function isMessage(argument: unknown): argument is Message {
	return (
		typeof argument === 'object' && typeof (argument as Partial<Message>)?.content === 'string'
	);
}

function translateOutgoing({ args }: { args: unknown[] }) {
	const message = args.find(isMessage);

	if (message?.content) {
		message.content = translate(message.content);
	}
}

/**
 * @description Tells whether outgoing messages are being translated.
 * @returns `true` while the patches are installed.
 */
export function isTranslating(): boolean {
	return patched;
}

/**
 * @description Rewrites each message the user sends or edits into Aussie English before Discord sends it.
 * Patches `sendMessage` and `editMessage` on Discord's message actions, which both platforms share.
 * @returns A function that removes the patches.
 */
export function startTranslation(): () => void {
	const unpatches = (['sendMessage', 'editMessage'] as const)
		.filter((method) => typeof Messages[method] === 'function')
		.map((method) => patcher.before(Messages, method, translateOutgoing));

	patched = unpatches.length > 0;

	return () => {
		for (const unpatch of unpatches) unpatch();
		patched = false;
	};
}
