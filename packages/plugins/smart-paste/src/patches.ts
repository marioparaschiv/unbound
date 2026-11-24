import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';
import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import {
	asCodeBlock,
	asPlainText,
	asQuote,
	formatsFor,
	singleLink,
	type PasteFormat,
} from '~/lib/paste-formats';
import FormatSheet from '~/components/format-sheet';

type ChatInput = { insertText?: (text: string) => void };

type ChatInputRegistry = {
	getBestActiveInputForChannelId?: (channelId: string) => ChatInput | null | undefined;
};

function insert(channelId: string, text: string) {
	const registry = metro.findByProps('getBestActiveInputForChannelId') as
		| ChatInputRegistry
		| undefined;

	registry?.getBestActiveInputForChannelId?.(channelId)?.insertText?.(text);
}

async function paste(channelId: string, format: PasteFormat, text: string, folder: string) {
	if (format === 'file') {
		const attached = await attachFile(channelId, text, {
			folder,
			filename: messages.FILE_NAME,
			mimeType: 'text/plain',
		}).catch(() => false);

		if (!attached) toasts.warning('FILE_FAILED');

		return;
	}

	const formatted = {
		plain: () => asPlainText(text),
		code: () => asCodeBlock(text),
		quote: () => asQuote(text),
		link: () => `<${singleLink(text) ?? text.trim()}>`,
	}[format]();

	insert(channelId, formatted);
}

async function offerFormats(channelId: string, folder: string) {
	const text = await metro.common.Clipboard.getString();

	if (!text) {
		toasts.info('EMPTY');

		return;
	}

	openSheet('unbound-smart-paste', FormatSheet, {
		formats: formatsFor(text),
		onPick: (format: PasteFormat) => void paste(channelId, format, text, folder),
	});
}

/**
 * @description Adds a paste button to the chat input that offers the clipboard's text as plain text, a code block, a
 * quote, a link without a preview or a text file attachment.
 * @param folder The plugin's temporary folder, for text file attachments.
 */
export function patchPasteButton(folder: string): void {
	patchChatInputButton({
		key: 'smart-paste',
		name: 'Smart Paste',
		icon: 'ClipboardListIcon',
		label: () => messages.BUTTON,
		onPress: (channelId) => void offerFormats(channelId, folder),
		showWhenEmpty: true,
	});
}

export default { patchPasteButton };
