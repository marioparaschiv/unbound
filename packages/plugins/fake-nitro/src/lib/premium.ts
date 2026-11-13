import { flux, metro } from '@unbound-app/api';

import '~/lib/types';

type CustomEmoji = { type?: number; available?: boolean; animated?: boolean; guildId?: string };

type Channel = { id: string; guild_id?: string | null };

const UNICODE = 0;

/**
 * @description Whether the user can send an emoji for real in a channel, without Nitro tricks, as Vencord's FakeNitro checks.
 * @param emoji The emoji.
 * @param channel The channel.
 * @returns Whether Discord would send it as an emoji.
 */
export function canUseEmoji(emoji: CustomEmoji, channel: Channel | undefined): boolean {
	if (emoji.type === UNICODE) return true;

	if (emoji.available === false) return false;

	const premium = metro.findByProps('canUseEmojisEverywhere', { lazy: false });
	const user = flux.getStore('User').getCurrentUser();
	const sameGuild = Boolean(channel?.guild_id) && emoji.guildId === channel?.guild_id;

	if (!premium?.canUseEmojisEverywhere(user)) return !emoji.animated && sameGuild;

	const externalEmojis = metro.common.Constants.Permissions.USE_EXTERNAL_EMOJIS;

	return (
		sameGuild ||
		!channel?.guild_id ||
		Boolean(flux.getStore('Permission').can(externalEmojis, channel))
	);
}
