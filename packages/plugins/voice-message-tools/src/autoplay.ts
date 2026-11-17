import { flux, metro, patcher, utils } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import type { ReactNode } from 'react';

import {
	nextVoiceMessage,
	playedToEnd,
	type ChatMessage,
	type PlaybackEnded,
} from '~/lib/autoplay';

const NEXT_DELAY_MS = 350;

type ChatProps = { channelId?: string; onMediaAttachmentPlaybackEnded?: (event: unknown) => void };

type MessageStore = { getMessages(channelId: string): { toArray(): ChatMessage[] } | undefined };

type Play = (messageId: string) => Promise<boolean>;

const wrapped = new WeakSet<object>();

type WrappedEvent = { nativeEvent?: PlaybackEnded };

function eventOf(raw: unknown): PlaybackEnded {
	const wrapper = raw as WrappedEvent | undefined;

	return wrapper?.nativeEvent ?? (raw as PlaybackEnded | undefined) ?? {};
}

function playNext(channelId: string, event: PlaybackEnded, play: Play) {
	if (!settings.autoplay || !event.messageId || !playedToEnd(event)) return;

	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const next = nextVoiceMessage(
		Messages.getMessages(channelId)?.toArray() ?? [],
		event.messageId,
	);

	if (!next) return;

	setTimeout(() => {
		play(next).catch((error: unknown) =>
			logger.error(`Failed to autoplay voice message ${next}:`, error),
		);
	}, NEXT_DELAY_MS);
}

function wrapChat(chat: ChatProps, play: Play) {
	const original = chat.onMediaAttachmentPlaybackEnded;

	if (!original || !chat.channelId || wrapped.has(chat)) return;

	const channelId = chat.channelId;

	wrapped.add(chat);
	chat.onMediaAttachmentPlaybackEnded = (raw: unknown) => {
		original(raw);
		playNext(channelId, eventOf(raw), play);
	};
}

/**
 * @description Plays the next voice message in a chat when one finishes, by wrapping the chat's
 * `onMediaAttachmentPlaybackEnded` in `MessagesRenderer` and pressing the next message's play button natively.
 * @param play Presses a voice message's play button, when its player is on screen.
 */
export function patchAutoplay(play: Play): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Voice message autoplay skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) =>
				typeof (node as ChatProps | null)?.onMediaAttachmentPlaybackEnded === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat, play);
	});
}
