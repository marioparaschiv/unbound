import { flux } from '@unbound-app/api';

export type KnownEmoji = Record<string, { id: string; animated: boolean }>;

type GuildEmoji = { id: string; name: string; animated?: boolean; available?: boolean };

type EmojiStore = { getGuildEmoji?(guildId: string): GuildEmoji[] | undefined };

type GuildStore = { getGuilds(): Record<string, unknown> };

const SHORTCODE = /<a?:\w+:\d+>|:([A-Za-z0-9_~]{2,32}):/g;

/**
 * @description Turns `:name:` shortcodes, which Discord's composer shows for a picked custom emoji, into the
 * `<:name:id>` markdown a sent message carries, so the preview draws them as emoji.
 * @param content The draft.
 * @param known The custom emoji by name.
 * @returns The draft with known shortcodes replaced; raw emoji markdown stays as it is.
 */
export function emojiMarkdown(content: string, known: KnownEmoji): string {
	return content.replace(SHORTCODE, (whole, name: string | undefined) => {
		const emoji = name ? known[name] : undefined;

		return emoji ? `<${emoji.animated ? 'a' : ''}:${name}:${emoji.id}>` : whole;
	});
}

/**
 * @description Lists the custom emoji of every server, the current one first so its names win.
 * @param guildId The channel's server, if any.
 * @returns The emoji, by name.
 */
export function knownEmoji(guildId: string | undefined): KnownEmoji {
	const store = flux.getStore('Emoji') as unknown as EmojiStore;
	const ids = Object.keys((flux.getStore('Guild') as unknown as GuildStore).getGuilds());
	const known: KnownEmoji = {};

	for (const id of guildId ? [guildId, ...ids.filter((other) => other !== guildId)] : ids) {
		for (const emoji of store.getGuildEmoji?.(id) ?? []) {
			if (emoji.available === false || known[emoji.name]) continue;

			known[emoji.name] = { id: emoji.id, animated: Boolean(emoji.animated) };
		}
	}

	return known;
}
