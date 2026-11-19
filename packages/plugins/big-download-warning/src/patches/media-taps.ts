import { dialogs, flux, metro, patcher, utils } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import type { ReactNode } from 'react';

import { attachmentByUrl, type Attachment } from '~/lib/attachments';
import { formatMegabytes, shouldAsk } from '~/lib/size';

type MediaEvent = { nativeEvent?: { id?: string; type?: string; index?: number } };
type LinkEvent = { nativeEvent?: { data?: { url?: string } } };
type ChatProps = {
	channelId?: string;
	onTapImage?: (event: MediaEvent) => void;
	onTapLink?: (event: LinkEvent) => void;
};
type StoredMessage = { attachments?: Attachment[] };
type MessageStore = {
	getMessage(channelId: string, messageId: string): StoredMessage | undefined;
	getMessages(channelId: string): { toArray?: () => StoredMessage[] } | undefined;
};
type NetworkStore = { getType(): string };

function messageStore(): MessageStore {
	return flux.getStore('Message') as unknown as MessageStore;
}

function mediaSize(channelId: string | undefined, event: MediaEvent): number | undefined {
	const { id, type, index = 0 } = event?.nativeEvent ?? {};

	if (!channelId || !id || type !== 'attachment') return undefined;

	return messageStore().getMessage(channelId, id)?.attachments?.[index]?.size;
}

function fileSize(channelId: string | undefined, event: LinkEvent): number | undefined {
	const url = event?.nativeEvent?.data?.url;

	if (!channelId || !url) return undefined;

	const loaded = messageStore().getMessages(channelId)?.toArray?.() ?? [];

	return attachmentByUrl(
		loaded.flatMap((message) => message.attachments ?? []),
		url,
	)?.size;
}

function isCellular(): boolean {
	return (flux.getStore('Network') as unknown as NetworkStore).getType?.() === 'cellular';
}

function askFirst(size: number | undefined, open: () => void): void {
	if (!shouldAsk(size, settings.threshold, isCellular())) {
		open();

		return;
	}

	dialogs.showDialog({
		title: messages.TITLE,
		body: format('BODY', { size: formatMegabytes(size!) }),
		buttons: [{ label: messages.OPEN, onPress: open }],
		cancel: messages.CANCEL,
	});
}

function wrapMedia(chat: ChatProps) {
	const original = chat.onTapImage;

	if (!original) return;

	chat.onTapImage = (event) => {
		const saved: MediaEvent = { ...event, nativeEvent: { ...event?.nativeEvent } };

		askFirst(mediaSize(chat.channelId, event), () => original(saved));
	};
}

function wrapFiles(chat: ChatProps) {
	const original = chat.onTapLink;

	if (!original) return;

	chat.onTapLink = (event) => {
		const saved: LinkEvent = {
			...event,
			nativeEvent: { ...event?.nativeEvent, data: { ...event?.nativeEvent?.data } },
		};

		askFirst(fileSize(chat.channelId, event), () => original(saved));
	};
}

/**
 * @description Asks before a large attachment opens on mobile data: images and videos through the chat's
 * `onTapImage`, and files such as archives or documents, which open as links to the attachment, through its
 * `onTapLink`. Patches the render of `MessagesRenderer` to wrap both.
 */
export function patchMediaTaps(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Big Download Warning skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapImage === 'function',
		) as ChatProps | undefined;

		if (!chat) return;

		wrapMedia(chat);
		wrapFiles(chat);
	});
}

export default patchMediaTaps;
