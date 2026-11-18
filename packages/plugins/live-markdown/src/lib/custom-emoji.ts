export type CustomEmoji = { id: string; animated: boolean };

export type EmojiToken = { start: number; length: number; id: string; animated: boolean };

const TOKEN = /<(a?):([A-Za-z0-9_~]{2,32}):(\d{17,20})>|:([A-Za-z0-9_~]{2,32}):/g;

/**
 * @description Finds custom emoji in composer text: raw `<a:name:id>` markdown, and `:name:` for the emoji the user
 * can use here, which is how Discord shows a picked emoji.
 * @param text The composer text.
 * @param known The usable custom emoji, by name.
 * @returns Each emoji with its UTF-16 offset and length.
 */
export function emojiTokens(text: string, known: Record<string, CustomEmoji>): EmojiToken[] {
	'worklet';
	const tokens: EmojiToken[] = [];

	TOKEN.lastIndex = 0;

	for (let match = TOKEN.exec(text); match; match = TOKEN.exec(text)) {
		const [whole, animated, , rawId, shortName] = match;
		const emoji = rawId ? { id: rawId, animated: animated === 'a' } : known[shortName ?? ''];

		if (emoji) tokens.push({ start: match.index, length: whole.length, ...emoji });
	}

	return tokens;
}

/**
 * @description Builds the CDN link of a custom emoji's image, a GIF when it is animated.
 * @param emoji The emoji.
 * @param size The pixel size to ask for.
 * @returns The link.
 */
export function emojiUrl({ id, animated }: CustomEmoji, size = 96): string {
	'worklet';

	return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=${size}`;
}
