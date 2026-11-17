import { flux, metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

/**
 * @description Sends a comic's link to the chat you have open, where Discord embeds it.
 * @param num The comic number.
 * @returns Whether it was sent.
 */
export function shareComic(num: number): boolean {
	const channelId = flux.getStore('SelectedChannel').getChannelId?.() as string | undefined;

	if (!channelId) {
		toasts.show({ title: addon.name, content: messages.NO_CHANNEL });

		return false;
	}

	void metro.api.Messages.sendMessage(
		channelId,
		{
			content: `https://xkcd.com/${num}/`,
			tts: false,
			invalidEmojis: [],
			validNonShortcutEmojis: [],
		},
		true,
		{},
	);

	return true;
}
