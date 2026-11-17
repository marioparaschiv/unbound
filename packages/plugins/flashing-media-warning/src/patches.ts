import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openFlashSheet } from '~/components/flash-sheet';
import type { Media } from '~/lib/sources';

const SHEET_SWAP_MS = 350;
const GIF = /\.gif(\?|$)/i;
const VIDEO = /\.(mp4|mov|m4v|webm)(\?|$)/i;

type Attachment = { url?: string; filename?: string; content_type?: string };

type Embed = {
	type?: string;
	url?: string;
	video?: { url?: string; proxyURL?: string; proxy_url?: string };
};

type SheetProps = { message?: { attachments?: Attachment[]; embeds?: Embed[] } };

function attachmentMedia(attachment: Attachment): Media | undefined {
	const { url, filename = '', content_type: type = '' } = attachment;

	if (!url) return undefined;
	if (type === 'image/gif' || GIF.test(filename)) return { url, kind: 'gif', name: filename };
	if (type.startsWith('video/') || VIDEO.test(filename))
		return { url, kind: 'video', name: filename };

	return undefined;
}

function embedMedia(embed: Embed): Media | undefined {
	const video = embed.video?.proxyURL ?? embed.video?.proxy_url ?? embed.video?.url;

	if (!video) return undefined;

	return { url: video, kind: GIF.test(video) ? 'gif' : 'video', name: embed.url ?? video };
}

/**
 * @description Finds a message's first animated media: a GIF or video attachment, or a GIF or video embed.
 * @param message The message.
 * @returns The media, or `undefined` for a message without any.
 */
export function animatedMedia(message: SheetProps['message']): Media | undefined {
	for (const attachment of message?.attachments ?? []) {
		const media = attachmentMedia(attachment);

		if (media) return media;
	}

	for (const embed of message?.embeds ?? []) {
		const media = embedMedia(embed);

		if (media) return media;
	}

	return undefined;
}

/**
 * @description Adds Check for Flashing to the long-press sheet of messages with a GIF or video.
 * @param bridge The plugin's native bridge.
 * @param folder The plugin's temporary folder.
 */
export function patchActionSheets(bridge: NativeBridge, folder: string): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Flashing Media Warning row skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const media = animatedMedia(props.message);

		if (!key.endsWith('MessageLongPressActionSheet') || !media) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-flashing-media',
					label: messages.CHECK,
					icon: 'EyeIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						setTimeout(() => openFlashSheet({ media, bridge, folder }), SHEET_SWAP_MS);
					},
				},
			]);

			return result;
		};
	});
}
