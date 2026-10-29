import { applyRules } from '@unbound-plugins/shared/text-replace/rules';

import { RULES_CHANNEL_ID } from '~/constants';
import { readRules } from '~/stored-rules';
import { Messages, Patcher } from '~/modules';

type Message = { content: string };
type MessageArgument = Partial<Message> | string | null | undefined;

function isMessage(argument: MessageArgument): argument is Message {
	return typeof argument === 'object' && typeof argument?.content === 'string';
}

let patched = false;

/**
 * @description Tells whether outgoing messages are being rewritten.
 * @returns `true` while the patch is installed.
 */
export function isPatched(): boolean {
	return patched;
}

/**
 * @description Rewrites each outgoing message with the stored rules before Discord sends it.
 * @returns A function that removes the patch.
 */
export function patchMessageActions(): () => void {
	const unpatch = Patcher.before(Messages, 'sendMessage', ({ args }) => {
		if (args[0] === RULES_CHANNEL_ID) return;

		const message = (args as MessageArgument[]).find(isMessage);

		if (!message?.content) return;

		message.content = applyRules(
			message.content,
			readRules('stringRules'),
			readRules('regexRules'),
		);
	});

	patched = true;

	return () => {
		unpatch();
		patched = false;
	};
}
