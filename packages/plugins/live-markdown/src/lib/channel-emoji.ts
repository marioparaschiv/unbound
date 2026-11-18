import { flux } from '@unbound-app/api';

import type { CustomEmoji } from '~/lib/custom-emoji';

type GuildEmoji = { id: string; name: string; animated?: boolean; available?: boolean };

type EmojiStore = { getGuildEmoji?(guildId: string): GuildEmoji[] | undefined };

type GuildStore = { getGuilds(): Record<string, unknown> };

/**
 * @description Lists the custom emoji names the composer may show, the current server's first so its names win.
 * @param guildId The current channel's server, if any.
 * @returns The emoji, by name.
 */
export function channelEmoji(guildId: string | undefined): Record<string, CustomEmoji> {
	const Emoji = flux.getStore('Emoji') as unknown as EmojiStore;
	const guildIds = Object.keys((flux.getStore('Guild') as unknown as GuildStore).getGuilds());
	const ordered = guildId ? [guildId, ...guildIds.filter((id) => id !== guildId)] : guildIds;
	const known: Record<string, CustomEmoji> = {};

	for (const id of ordered) {
		for (const emoji of Emoji.getGuildEmoji?.(id) ?? []) {
			if (emoji.available === false || known[emoji.name]) continue;

			known[emoji.name] = { id: emoji.id, animated: Boolean(emoji.animated) };
		}
	}

	return known;
}
