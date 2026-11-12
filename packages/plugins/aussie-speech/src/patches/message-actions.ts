import { metro, patcher } from '@unbound-app/api';

import { settings } from '@unbound-app/settings';

import { translate } from '~/lib/translator';
import { aussieToggle } from '~/lib/toggle';

type Message = { content: string };

let patched = false;

function isMessage(argument: unknown): argument is Message {
	return (
		typeof argument === 'object' && typeof (argument as Partial<Message>)?.content === 'string'
	);
}

function translateOutgoing({ args }: { args: unknown[] }) {
	const [channelId] = args;
	const message = args.find(isMessage);

	if (!message?.content || typeof channelId !== 'string') {
		return;
	}

	const active = aussieToggle.takeForSend(channelId, {
		persist: settings.persistState,
		autoDisable: settings.autoDisable,
	});

	if (active) {
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
 */
export function patchMessageActions(): void {
	const Messages = metro.api.Messages;

	if (!Messages) {
		logger.warn('Translation skipped: Discord moved Messages.');

		return;
	}

	for (const method of ['sendMessage', 'editMessage'] as const) {
		if (typeof Messages[method] !== 'function') continue;

		patcher.before(Messages, method, translateOutgoing);
		patched = true;
	}
}
