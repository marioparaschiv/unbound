import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { format } from '@unbound-app/i18n';
import { metro, patcher, toasts, utils } from '@unbound-app/api';

import { attachmentFileName, downloadPdf, isPdf } from '~/lib/pdf-files';
import type { PdfViewer } from '~/native/viewer';

type AttachmentEvent = { nativeEvent?: { data?: { attachmentUrl?: string; fileName?: string } } };

type LinkEvent = { nativeEvent?: { data?: { url?: string } } };

type ChatProps = {
	onTapAttachmentLink?: (event: AttachmentEvent) => void;
	onTapLink?: (event: LinkEvent) => void;
};

async function openPdf(viewer: PdfViewer, folder: string, url: string, fileName: string) {
	const toast = toasts.show({ content: format('OPENING', { name: fileName }), duration: 0 });

	try {
		await viewer.open(await downloadPdf(url, folder, fileName));
	} catch (error) {
		logger.error(`Failed to open PDF ${fileName}:`, error);
		toasts.warning('FAILED');
		void Linking.openURL(url).catch(() => undefined);
	} finally {
		toast.close();
	}
}

function wrapChat(chat: ChatProps, viewer: PdfViewer, folder: string) {
	const original = chat.onTapAttachmentLink;

	chat.onTapAttachmentLink = (event) => {
		const { attachmentUrl, fileName } = event?.nativeEvent?.data ?? {};

		if (!attachmentUrl || !isPdf(fileName)) {
			original?.(event);

			return;
		}

		void openPdf(viewer, folder, attachmentUrl, fileName!);
	};

	const tapLink = chat.onTapLink;

	chat.onTapLink = (event) => {
		const url = event?.nativeEvent?.data?.url;
		const fileName = url ? attachmentFileName(url) : undefined;

		if (!url || !isPdf(fileName)) {
			tapLink?.(event);

			return;
		}

		void openPdf(viewer, folder, url, fileName!);
	};
}

/**
 * @description Opens tapped PDF attachments in the phone's PDF viewer, by patching the render of Discord's
 * `MessagesRenderer` to wrap the chat's attachment and link tap handlers, since iOS hands a tap on a file over as a
 * link to the attachment. Other attachments and links open as before.
 * @param viewer The platform's PDF viewer.
 * @param folder The plugin's temporary folder, where PDFs download to.
 */
export function patchAttachmentTaps(viewer: PdfViewer, folder: string): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('PDF taps skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) =>
				typeof (node as ChatProps | null)?.onTapAttachmentLink === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat, viewer, folder);
	});
}

export default { patchAttachmentTaps };
