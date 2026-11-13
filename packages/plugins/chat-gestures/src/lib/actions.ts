import { dialogs, flux, metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';

import type { FluxStore } from '@unbound-app/api/flux';

import { reactionEmoji, type GestureAction } from '~/lib/gestures';

type Message = { id: string; channel_id: string; content: string; author: { id: string } };

type Channel = { id: string; guild_id?: string | null };

type MessageStore = FluxStore & { getMessage(channelId: string, id: string): Message | undefined };

type ChatInput = { openSystemKeyboard?(): void; focus?(): void };

type ChatInputs = { getBestActiveInputForChannelId?(channelId: string): ChatInput | undefined };

/**
 * @description Opens the keyboard on a channel's message box when the user asked for it after replies and edits.
 * @param channelId The channel whose message box to focus.
 */
export function openKeyboard(channelId: string): void {
	if (!settings.openKeyboard) return;

	const inputs = metro.findByProps('getBestActiveInputForChannelId') as ChatInputs | undefined;

	setTimeout(() => {
		const input = inputs?.getBestActiveInputForChannelId?.(channelId);

		if (input?.openSystemKeyboard) input.openSystemKeyboard();
		else input?.focus?.();
	}, 0);
}

function isOwn(message: Message): boolean {
	return message.author.id === flux.getStore('User').getCurrentUser()?.id;
}

function reply(message: Message, channel: Channel): void {
	metro.findByProps('createPendingReply')?.createPendingReply({
		channel,
		message,
		shouldMention: true,
		showMentionToggle: Boolean(channel.guild_id),
	});
}

function edit(message: Message): void {
	metro.api.Messages.startEditMessage(message.channel_id, message.id, message.content);
}

async function react(message: Message): Promise<void> {
	const emoji = reactionEmoji(settings.reactEmoji);

	if (!emoji) return;

	await metro.common.REST.put({
		url: `/channels/${message.channel_id}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`,
	});
}

function save(message: Message): void {
	const helpers = metro.findByFilePath('modules/saved_messages/SavedMessageHelpers.native.tsx');
	const sources = metro.findByProps('SavedMessageSources')?.SavedMessageSources;

	helpers?.addOrUpdateSavedMessage({
		channelId: message.channel_id,
		messageId: message.id,
		dueAt: undefined,
		displayToast: true,
		source: sources?.LONG_PRESS_ACTION_SHEET,
	});
}

function copy(message: Message): void {
	metro.common.Clipboard.setString(message.content);
	toasts.show({ title: messages.PLUGIN, content: messages.COPIED });
}

async function remove(message: Message): Promise<void> {
	const confirmed = await dialogs.confirm('DELETE_TITLE', {
		body: 'DELETE_BODY',
		confirm: 'DELETE',
		destructive: true,
	});

	if (confirmed) metro.api.Messages.deleteMessage(message.channel_id, message.id);
}

/**
 * @description Runs a gesture's action on a message.
 * @param action The action the user picked.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns Settles once the action is done; edits and deletes only apply to the user's own messages.
 */
export async function runAction(
	action: GestureAction,
	channelId: string,
	messageId: string,
): Promise<void> {
	const message = (flux.getStore('Message') as MessageStore).getMessage(channelId, messageId);
	const channel = flux.getStore('Channel').getChannel(channelId) as Channel | undefined;

	if (!message || !channel) return;

	try {
		switch (action) {
			case 'replyOrEdit':
				if (isOwn(message)) edit(message);
				else reply(message, channel);

				return openKeyboard(channelId);
			case 'reply':
				reply(message, channel);

				return openKeyboard(channelId);
			case 'react':
				return await react(message);
			case 'forward':
				return metro
					.findByProps('openForwardModal')
					?.openForwardModal({ message, source: 'message_gesture' });
			case 'save':
				return save(message);
			case 'copy':
				return copy(message);
			case 'delete':
				return isOwn(message) ? await remove(message) : undefined;
			default:
				return;
		}
	} catch (error) {
		logger.error(`Failed to ${action} message ${messageId}:`, error);
	}
}
