import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { Messages } from '~/translation/modules';
import { translate } from '~/translation/translator';

type Message = { content: string };

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
 * @returns `true` once the patches are installed.
 */
export function isTranslating(): boolean {
	return patched;
}

/**
 * @description Rewrites each message the user sends or edits into Aussie English before Discord sends it.
 * Patches `sendMessage` and `editMessage` on Discord's message actions, which both platforms share.
 * The Addon scope removes the patches when the plugin stops.
 */
export function startTranslation(): void {
	if (!ensureModules({ Messages })) return;

	for (const method of ['sendMessage', 'editMessage'] as const) {
		if (typeof Messages[method] !== 'function') continue;

		patcher.before(Messages, method, translateOutgoing);
		patched = true;
	}
}
