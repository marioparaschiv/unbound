import { dialogs, flux, metro, patcher, utils } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import type { ReactNode } from 'react';

import { formatMegabytes, shouldAsk } from '~/lib/size';

type MediaEvent = { nativeEvent?: { id?: string; type?: string; index?: number } };
type ChatProps = { channelId?: string; onTapImage?: (event: MediaEvent) => void };
type MessageStore = {
	getMessage(
		channelId: string,
		messageId: string,
	): { attachments?: { size?: number }[] } | undefined;
};
type NetworkStore = { getType(): string };

function attachmentSize(channelId: string | undefined, event: MediaEvent): number | undefined {
	const { id, type, index = 0 } = event?.nativeEvent ?? {};

	if (!channelId || !id || type !== 'attachment') return undefined;

	const store = flux.getStore('Message') as unknown as MessageStore;

	return store.getMessage(channelId, id)?.attachments?.[index]?.size;
}

function isCellular(): boolean {
	return (flux.getStore('Network') as unknown as NetworkStore).getType?.() === 'cellular';
}

function wrapChat(chat: ChatProps) {
	const original = chat.onTapImage;

	if (!original) return;

	chat.onTapImage = (event) => {
		const size = attachmentSize(chat.channelId, event);

		if (!shouldAsk(size, settings.threshold, isCellular())) {
			original(event);

			return;
		}

		const saved: MediaEvent = { ...event, nativeEvent: { ...event?.nativeEvent } };

		dialogs.showDialog({
			title: messages.TITLE,
			body: format('BODY', { size: formatMegabytes(size!) }),
			buttons: [{ label: messages.OPEN, onPress: () => original(saved) }],
			cancel: messages.CANCEL,
		});
	};
}

/**
 * @description Asks before a large image or video attachment opens on mobile data. Patches the render of
 * `MessagesRenderer` to wrap the chat's `onTapImage`.
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

		if (chat) wrapChat(chat);
	});
}

export default patchMediaTaps;
