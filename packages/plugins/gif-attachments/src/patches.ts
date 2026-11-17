import { attachFile } from '@unbound-plugins/shared/composer/attach-file';
import { toBase64 } from '@unbound-plugins/shared/media/sound-download';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { gifFile, gifMedia, type FavoriteGif, type PickerItem } from '~/lib/media';

type GifSelection = [channelId: string, message: { content: string }, ...rest: unknown[]];

type PickerView = { getResultItems?(): PickerItem[] | undefined };

type SettingsProto = {
	frecencyWithoutFetchingLatest?: { favoriteGifs?: { gifs?: Record<string, FavoriteGif> } };
};

const MAX_BYTES = 10 * 1024 * 1024;

function isGifSelection(args: unknown[]): args is GifSelection {
	const [channelId, message, , metadata] = args;

	return (
		typeof channelId === 'string' &&
		typeof (message as GifSelection[1] | undefined)?.content === 'string' &&
		(metadata as { location?: string } | undefined)?.location === 'gif_reply'
	);
}

function mediaFor(link: string): string | undefined {
	const results =
		(flux.getStore('GIFPickerView') as unknown as PickerView).getResultItems?.() ?? [];
	const favorites =
		(flux.getStore('UserSettingsProto') as unknown as SettingsProto)
			.frecencyWithoutFetchingLatest?.favoriteGifs?.gifs ?? {};

	return gifMedia(link, results, favorites);
}

async function attachGif(
	channelId: string,
	link: string,
	media: string,
	folder: string,
	sendLink: () => unknown,
) {
	const file = gifFile(link, media);
	const toast = toasts.show({ title: addon.name, content: messages.DOWNLOADING, duration: 0 });

	try {
		const response = await fetch(file.url);

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const bytes = new Uint8Array(await response.arrayBuffer());

		if (bytes.byteLength > MAX_BYTES) {
			toasts.show({ title: addon.name, content: messages.TOO_LARGE });
			sendLink();

			return;
		}

		await attachFile(channelId, toBase64(bytes), {
			folder,
			filename: file.filename,
			mimeType: file.mimeType,
			encoding: 'base64',
		});
	} catch (error) {
		logger.error(`Failed to download GIF ${file.url}:`, error);
		toasts.show({ title: addon.name, content: messages.FAILED });
		sendLink();
	} finally {
		toast.close();
	}
}

/**
 * @description Adds a GIF picked in the GIF picker to the message as a file instead of sending its link, by patching
 * `sendMessage` on Discord's `MessageActions`. GIFs it can't find the file for, and ones over 10 MB, still go as links.
 * @param folder The plugin's temporary folder, where downloads are written.
 */
export function patchGifSelections(folder: string): void {
	const MessageActions = metro.api.Messages;

	if (!MessageActions?.sendMessage) {
		logger.warn('GIF attachments skipped: Discord moved MessageActions.');

		return;
	}

	patcher.instead(MessageActions, 'sendMessage', ({ args, original, this: self }) => {
		if (!isGifSelection(args)) return original.apply(self, args);

		const [channelId, message] = args;
		const media = mediaFor(message.content);

		if (!media) return original.apply(self, args);

		void attachGif(channelId, message.content, media, folder, () => original.apply(self, args));

		return Promise.resolve();
	});
}
