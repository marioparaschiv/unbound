import { metro, patcher, utils } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import type { ReactNode } from 'react';

import { runAction } from '~/lib/actions';
import { createTapCounter, type GestureAction } from '~/lib/gestures';

type GestureEvent = { nativeEvent?: { messageId?: string } };

type Handler = (event: GestureEvent) => void;

type ChatProps = Record<
	'onDoubleTapMessage' | 'onTapMessage' | 'onInitiateReply' | 'onInitiateEdit',
	Handler | undefined
> & {
	channelId?: string;
};

type Target = { messageId: string; channelId: string };

const taps = createTapCounter();

function readTarget(chat: ChatProps, event: GestureEvent): Target | undefined {
	const messageId = event?.nativeEvent?.messageId;
	const { channelId } = chat;

	return typeof messageId === 'string' && channelId ? { messageId, channelId } : undefined;
}

function perform(
	action: GestureAction,
	message: Target | undefined,
	discordDefault: () => void,
): void {
	if (action === 'discord' || !message) return discordDefault();

	if (action !== 'nothing') void runAction(action, message.channelId, message.messageId);
}

function wrap(props: ChatProps): void {
	const { onDoubleTapMessage, onTapMessage, onInitiateReply, onInitiateEdit } = props;
	const target = (event: GestureEvent) => readTarget(props, event);

	props.onDoubleTapMessage = (event) => {
		const message = target(event);
		const kept = { ...event, nativeEvent: { ...event?.nativeEvent } };
		const waitForTriple = settings.tripleTap !== 'nothing';

		taps.doubleTap(message?.messageId ?? '', waitForTriple, () =>
			perform(settings.doubleTap as GestureAction, message, () => onDoubleTapMessage?.(kept)),
		);
	};
	props.onTapMessage = (event) => {
		const message = target(event);

		if (message && taps.tap(message.messageId)) {
			perform(settings.tripleTap as GestureAction, message, () => undefined);

			return;
		}

		onTapMessage?.(event);
	};
	props.onInitiateReply = (event) =>
		perform(settings.swipe as GestureAction, target(event), () => onInitiateReply?.(event));
	props.onInitiateEdit = (event) =>
		perform(settings.swipe as GestureAction, target(event), () => onInitiateEdit?.(event));
}

/**
 * @description Runs the actions the user picked for double tap, triple tap and swipe on chat messages. Patches the render
 * of Discord's `MessagesRenderer` to wrap the gesture handlers it gives the native chat.
 */
export function patchChatGestures(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Chat gestures skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) =>
				typeof (node as { onDoubleTapMessage?: unknown } | null)?.onDoubleTapMessage ===
				'function',
		) as ChatProps | undefined;

		if (chat) wrap(chat);
	});
}
