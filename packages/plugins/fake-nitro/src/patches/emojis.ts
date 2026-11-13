import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { emojiLink, emojisIn, replaceEmojis, type FakeEmoji } from '~/lib/links';
import { canUseEmoji } from '~/lib/premium';

type OutgoingMessage = {
	content?: string;
	validNonShortcutEmojis?: (FakeEmoji & { guildId?: string })[];
};

type EditedMessage = { content?: string };

type KnownEmoji = { guildId?: string };

type DisabledReasons = { PREMIUM_LOCKED?: number; DISALLOW_EXTERNAL?: number };

/**
 * @description Lets the emoji picker and autocomplete offer emojis Discord locks behind Nitro or the external emoji
 * permission. Patches Discord's emoji utilities to stop reporting those locks.
 */
export function patchEmojiUnlocks(): void {
	if (!settings.emojis) return;

	const EmojiUtils = metro.findByProps('getEmojiUnavailableReason', 'isEmojiPremiumLocked');
	const reasons: DisabledReasons =
		metro.findByProps('EmojiDisabledReasons', { lazy: false })?.EmojiDisabledReasons ?? {};
	const bypassed = new Set(
		[reasons.PREMIUM_LOCKED, reasons.DISALLOW_EXTERNAL].filter(
			(reason) => reason !== undefined,
		),
	);

	if (!EmojiUtils) {
		logger.warn('Fake emojis skipped: Discord moved its emoji utilities.');

		return;
	}

	patcher.instead(EmojiUtils, 'isEmojiPremiumLocked', () => false);
	patcher.instead(EmojiUtils, 'isEmojiCategoryNitroLocked', () => false);
	patcher.after(EmojiUtils, 'getEmojiUnavailableReason', ({ result }) =>
		bypassed.has(result as number) ? null : result,
	);
	patcher.instead(EmojiUtils, 'isEmojiFilteredOrLocked', ({ args }) =>
		EmojiUtils.isEmojiFiltered(...args),
	);
	patcher.instead(
		EmojiUtils,
		'isEmojiDisabled',
		({ args }) => EmojiUtils.getEmojiUnavailableReason(...args) != null,
	);
	patcher.before(EmojiUtils, 'getEmojiUnavailableReasons', ({ args }) => {
		const options = args[0] as { bypassPremiumEmojiEntitlement?: boolean } | undefined;

		if (options) options.bypassPremiumEmojiEntitlement = true;
	});
}

/**
 * @description Sends each emoji the user cannot use as a link to its image. Patches `sendMessage` on Discord's message actions.
 */
export function patchEmojiSending(): void {
	if (!settings.emojis) return;

	patcher.before(metro.api.Messages, 'sendMessage', ({ args }) => {
		const [channelId, message] = args as [string, OutgoingMessage | undefined];

		if (!message?.content || !message.validNonShortcutEmojis?.length) return;

		const channel = flux.getStore('Channel').getChannel(channelId);

		message.content = replaceEmojis(
			message.content,
			message.validNonShortcutEmojis,
			(emoji) => canUseEmoji(emoji, channel),
			(emoji) => emojiLink(emoji, settings.emojiSize, settings.hyperlinks),
		);
		message.validNonShortcutEmojis = message.validNonShortcutEmojis.filter((emoji) =>
			canUseEmoji(emoji, channel),
		);
	});
}

function withGuild(emoji: FakeEmoji): FakeEmoji & KnownEmoji {
	const known = flux.getStore('Emoji').getCustomEmojiById(emoji.id) as KnownEmoji | undefined;

	return { ...emoji, guildId: known?.guildId };
}

/**
 * @description Links unusable emojis again when the user edits a message that showed them as real emojis.
 * Patches `editMessage` on Discord's message actions.
 */
export function patchEmojiEditing(): void {
	if (!settings.emojis) return;

	patcher.before(metro.api.Messages, 'editMessage', ({ args }) => {
		const [channelId, , message] = args as [string, string, EditedMessage | undefined];

		if (!message?.content) return;

		const channel = flux.getStore('Channel').getChannel(channelId);

		message.content = replaceEmojis(
			message.content,
			emojisIn(message.content).map(withGuild),
			(emoji) => canUseEmoji(emoji, channel),
			(emoji) => emojiLink(emoji, settings.emojiSize, settings.hyperlinks),
		);
	});
}
