import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { splitMessage } from '~/lib/split';

type MessageLength = { getMaxMessageLength(): number };

type SendUtils = { chatInputHandleSendText(...args: unknown[]): unknown };

type OutgoingMessage = { content?: string };

type SendMessage = (
	channelId: string,
	message: OutgoingMessage,
	...rest: unknown[]
) => Promise<unknown>;

type MessageActions = { sendMessage: SendMessage };

let validating = false;

/**
 * @description Lets the chat input accept text over the length limit: while Discord sends a draft, `getMaxMessageLength` reports no
 * limit, so the draft is parsed in full instead of being refused with the Message Too Long alert.
 * Patches `chatInputHandleSendText` and `getMaxMessageLength`.
 */
export function patchLengthCheck(): void {
	const Length = metro.findByProps('getMaxMessageLength') as MessageLength | undefined;
	const SendUtils = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendUtils.tsx',
	) as SendUtils | undefined;

	if (!Length || !SendUtils?.chatInputHandleSendText) {
		logger.warn(
			'Split large messages skipped: Discord moved getMaxMessageLength or the send checks.',
		);

		return;
	}

	patcher.instead(SendUtils, 'chatInputHandleSendText', ({ args, original }) => {
		validating = true;

		try {
			return original(...args);
		} finally {
			validating = false;
		}
	});

	patcher.instead(Length, 'getMaxMessageLength', ({ args, original }) =>
		validating ? Number.MAX_SAFE_INTEGER : original(...args),
	);
}

/**
 * @description Sends a message over the length limit as several messages, one after another, each within the limit and up to the
 * Most parts setting. Patches `MessageActions.sendMessage`.
 */
export function patchSendMessage(): void {
	const Length = metro.findByProps('getMaxMessageLength') as MessageLength | undefined;
	const Messages = metro.api.Messages as MessageActions | undefined;

	if (!Length || !Messages?.sendMessage) {
		logger.warn('Split large messages skipped: Discord moved sendMessage.');

		return;
	}

	patcher.instead(Messages, 'sendMessage', async ({ args, original }) => {
		const [channelId, message, ...rest] = args as Parameters<SendMessage>;
		const content = message?.content ?? '';
		const lifted = validating;

		validating = false;

		const limit = Length.getMaxMessageLength();

		validating = lifted;

		const parts = splitMessage(content, limit);

		if (parts.length < 2 || parts.length > settings.maxParts) return original(...args);

		let result: unknown;

		for (const part of parts) {
			result = await original(channelId, { ...message, content: part }, ...rest);
		}

		return result;
	});
}

export default { patchLengthCheck, patchSendMessage };
