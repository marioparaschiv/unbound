import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { stickerLink, type FakeSticker } from '~/lib/links';

import '~/lib/types';

type Sendability = {
	getStickerSendability(sticker: unknown, user: unknown, channel: unknown): number;
};

const SENDABLE = 0;
const NONSENDABLE = 2;

let originalSendability: Sendability['getStickerSendability'] | undefined;

function sendableForReal(sticker: unknown, channel: unknown): boolean {
	const user = flux.getStore('User').getCurrentUser();

	return originalSendability?.(sticker, user, channel) === SENDABLE;
}

/**
 * @description Lets the sticker picker offer stickers Discord locks behind Nitro or another server. Patches
 * `getStickerSendability` and `isSendableSticker`.
 */
export function patchStickerUnlocks(): void {
	if (!settings.stickers) return;

	const Stickers = metro.findByProps('getStickerSendability', 'isSendableSticker', {
		lazy: false,
	});

	if (!Stickers) {
		logger.warn('Fake stickers skipped: Discord moved getStickerSendability.');

		return;
	}

	originalSendability = Stickers.getStickerSendability.bind(Stickers);
	patcher.after(Stickers, 'getStickerSendability', ({ result }) =>
		result === NONSENDABLE ? result : SENDABLE,
	);
	patcher.instead(Stickers, 'isSendableSticker', () => true);
}

/**
 * @description Sends each sticker the user cannot use as a link to its image. Patches `sendStickers` on Discord's message actions.
 */
export function patchStickerSending(): void {
	if (!settings.stickers) return;

	patcher.instead(metro.api.Messages, 'sendStickers', ({ args, original, this: self }) => {
		const [channelId, stickerIds] = args as [string, string[]];
		const StickersStore = flux.getStore('Sticker');
		const channel = flux.getStore('Channel').getChannel(channelId);
		const locked = stickerIds
			.map((id) => StickersStore.getStickerById(id) as FakeSticker | undefined)
			.filter(
				(sticker): sticker is FakeSticker =>
					Boolean(sticker) && !sendableForReal(sticker, channel),
			);

		if (!locked.length) return original.apply(self, args);

		const links = locked
			.map((sticker) => stickerLink(sticker, settings.stickerSize, settings.hyperlinks))
			.filter(Boolean);

		if (!links.length) {
			logger.warn(
				`Failed to send sticker ${locked[0]!.id}: animated stickers have no image to link.`,
			);

			return;
		}

		return metro.api.Messages.sendMessage(channelId, {
			content: links.join(' '),
			tts: false,
			invalidEmojis: [],
			validNonShortcutEmojis: [],
		});
	});
}
