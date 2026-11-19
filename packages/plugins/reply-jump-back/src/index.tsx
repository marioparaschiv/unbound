import { metro, patcher, utils } from '@unbound-app/api';
import type { ReactNode } from 'react';

import { tappedReplyId } from '~/lib/reply-event';
import { createReturnTargets, type JumpOptions } from '~/lib/return-target';

type ChatProps = { channelId?: string; onTapMessageReply?: (event: unknown) => unknown };
type MessageActions = { jumpToMessage: (options: JumpOptions) => unknown };

const targets = createReturnTargets();

function wrapReplyTaps(chat: ChatProps) {
	const original = chat.onTapMessageReply;

	if (!original) return;

	chat.onTapMessageReply = (event) => {
		const messageId = tappedReplyId(event);

		if (chat.channelId && messageId) targets.remember(chat.channelId, messageId);

		return original(event);
	};
}

export function start() {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');
	const Messages = metro.findByProps('jumpToMessage', 'jumpToPresent') as
		| MessageActions
		| undefined;

	if (!MessagesRenderer?.default || !Messages?.jumpToMessage) {
		logger.warn('Reply jump back skipped: Discord moved MessagesRenderer or jumpToMessage.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapMessageReply === 'function',
		) as ChatProps | undefined;

		if (chat) wrapReplyTaps(chat);
	});

	patcher.before(Messages, 'jumpToMessage', ({ args }) => {
		const [options] = args;

		if (options) args[0] = targets.withReturn(options);
	});
}

export function stop() {}
