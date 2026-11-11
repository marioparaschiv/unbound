import { applyRules } from '@unbound-plugins/shared/text-replace/rules';
import { metro, patcher } from '@unbound-app/api';

import { readRules } from '@unbound-plugins/shared/text-replace/stored-rules';

import { RULES_CHANNEL_ID } from '~/lib/constants';

type Message = { content: string };
type MessageArgument = Partial<Message> | string | null | undefined;

function isMessage(argument: MessageArgument): argument is Message {
	return typeof argument === 'object' && typeof argument?.content === 'string';
}

/**
 * @description Rewrites each outgoing message with the stored rules before Discord sends it, by patching
 * `sendMessage` of Discord's message actions (`metro.api.Messages`).
 */
export function patchMessages(): void {
	const { Messages } = metro.api;

	if (!Messages) {
		logger.warn('Text replace skipped: Discord moved Messages.');

		return;
	}

	patcher.before(Messages, 'sendMessage', ({ args }) => {
		if (args[0] === RULES_CHANNEL_ID) return;

		const message = (args as MessageArgument[]).find(isMessage);

		if (!message?.content) return;

		message.content = applyRules(
			message.content,
			readRules('stringRules'),
			readRules('regexRules'),
		);
	});
}
