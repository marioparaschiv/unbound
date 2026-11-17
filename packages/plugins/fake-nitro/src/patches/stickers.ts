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

type OutgoingMessage = { content?: string };

type SendOptions = { stickerIds?: string[] };

function lockedStickers(channelId: string, stickerIds: string[]): FakeSticker[] {
	const StickersStore = flux.getStore('Sticker');
	const channel = flux.getStore('Channel').getChannel(channelId);

	return stickerIds
		.map((id) => StickersStore.getStickerById(id) as FakeSticker | undefined)
		.filter(
			(sticker): sticker is FakeSticker =>
				Boolean(sticker) && !sendableForReal(sticker, channel),
		);
}

function linksFor(locked: FakeSticker[]): string[] {
	const links = locked
		.map((sticker) => stickerLink(sticker, settings.stickerSize, settings.hyperlinks))
		.filter((link): link is string => Boolean(link));

	if (links.length < locked.length) {
		logger.warn(
			`Failed to link a sticker in ${locked.map(({ id }) => id).join(', ')}: animated stickers have no image to link.`,
		);
	}

	return links;
}

function isSendOptions(value: unknown): value is SendOptions {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray((value as SendOptions).stickerIds)
	);
}

/**
 * @description Sends each sticker the user cannot use as a link to its image, whether picked into the message box or
 * sent on its own. Patches `sendMessage` and `sendStickers` on Discord's message actions.
 */
export function patchStickerSending(): void {
	if (!settings.stickers) return;

	const { Messages } = metro.api;

	patcher.before(Messages, 'sendMessage', ({ args }) => {
		const [channelId, message] = args as [string, OutgoingMessage | undefined, ...unknown[]];
		const optionsIndex = args.findIndex((arg, index) => index > 1 && isSendOptions(arg));
		const options = args[optionsIndex] as SendOptions | undefined;

		if (!message || !options?.stickerIds?.length) return;

		const locked = lockedStickers(channelId, options.stickerIds);

		if (!locked.length) return;

		const lockedIds = new Set(locked.map(({ id }) => id));
		const next = [...args];

		next[1] = {
			...message,
			content: [message.content, ...linksFor(locked)].filter(Boolean).join(' '),
		};
		next[optionsIndex] = {
			...options,
			stickerIds: options.stickerIds.filter((id) => !lockedIds.has(id)),
		};

		return next as typeof args;
	});

	patcher.instead(Messages, 'sendStickers', ({ args, original, this: self }) => {
		const [channelId, stickerIds] = args as [string, string[]];
		const locked = lockedStickers(channelId, stickerIds);

		if (!locked.length) return original.apply(self, args);

		const links = linksFor(locked);

		if (!links.length) return;

		return Messages.sendMessage(channelId, {
			content: links.join(' '),
			tts: false,
			invalidEmojis: [],
			validNonShortcutEmojis: [],
		});
	});
}
