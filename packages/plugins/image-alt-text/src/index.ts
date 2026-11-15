import { messages } from '@unbound-app/i18n';
import { flux, metro, patcher } from '@unbound-app/api';

import { readableDescriptions, withAltText, type ContentNode } from '~/lib/alt-text';

type Row = {
	message?: { id?: string; channelId?: string; content?: ContentNode[]; attachments?: unknown[] };
};
type MessageStore = {
	getMessage(
		channelId: string,
		messageId: string,
	): { attachments?: { description?: string | null }[] } | undefined;
};
type ChatManagerClass = { prototype?: { createRow(...args: unknown[]): unknown } };

function addAltText(row: Row) {
	const message = row?.message;

	if (
		!message?.id ||
		!message.channelId ||
		!message.attachments?.length ||
		!Array.isArray(message.content)
	)
		return;

	const source = (flux.getStore('Message') as unknown as MessageStore).getMessage(
		message.channelId,
		message.id,
	);
	const descriptions = readableDescriptions(
		(source?.attachments ?? []).map((attachment) => attachment.description),
	);

	if (descriptions.length)
		message.content = withAltText(message.content, descriptions, messages.ALT_TEXT);
}

export function start() {
	if (!metro.findByName('ChatManager')) {
		logger.warn('Image alt text skipped: Discord moved ChatManager.');

		return;
	}

	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		if (typeof ChatManager.prototype?.createRow !== 'function') {
			logger.warn('Image alt text skipped: Discord moved ChatManager.createRow.');

			return;
		}

		patcher.after(ChatManager.prototype, 'createRow', ({ result }) => {
			try {
				addAltText(result as Row);
			} catch (error) {
				logger.error('Failed to add alt text to a chat row:', error);
			}
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
