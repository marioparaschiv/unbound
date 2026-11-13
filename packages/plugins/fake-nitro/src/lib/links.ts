export type FakeEmoji = { id: string; name: string; animated?: boolean };

export type FakeSticker = { id: string; name: string; format_type: number };

const STICKER_EXTENSIONS: Record<number, string> = { 1: 'png', 2: 'png', 4: 'gif' };

function linked(url: string, name: string, hyperlink: boolean): string {
	return hyperlink ? `[${name}](${url})` : url;
}

/**
 * @description Links an emoji's image the way Vencord's FakeNitro sends it, so readers see the emoji as an embed.
 * @param emoji The emoji.
 * @param size The image size in pixels.
 * @param hyperlink Whether to hide the link behind the emoji's name.
 * @returns The link.
 */
export function emojiLink(emoji: FakeEmoji, size: number, hyperlink: boolean): string {
	const animated = emoji.animated ? '&animated=true' : '';
	const url = `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=${size}${animated}&name=${encodeURIComponent(emoji.name)}&lossless=true`;

	return linked(url, emoji.name, hyperlink);
}

/**
 * @description Links a sticker's image, for stickers Discord can draw as an image.
 * @param sticker The sticker.
 * @param size The image size in pixels.
 * @param hyperlink Whether to hide the link behind the sticker's name.
 * @returns The link, or `undefined` for an animated Lottie sticker, which has no image to link.
 */
export function stickerLink(
	sticker: FakeSticker,
	size: number,
	hyperlink: boolean,
): string | undefined {
	const extension = STICKER_EXTENSIONS[sticker.format_type];

	if (!extension) return;

	return linked(
		`https://media.discordapp.net/stickers/${sticker.id}.${extension}?size=${size}`,
		sticker.name,
		hyperlink,
	);
}

/**
 * @description Reads the custom emojis written into a message's text.
 * @param content The message text.
 * @returns Each distinct emoji, in the order it first appears.
 */
export function emojisIn(content: string): FakeEmoji[] {
	const found = new Map<string, FakeEmoji>();

	for (const [, animated, name, id] of content.matchAll(/<(a?):([^:>]+):(\d{17,20})>/g)) {
		if (!found.has(id)) found.set(id, { id, name, animated: animated === 'a' });
	}

	return [...found.values()];
}

/**
 * @description Replaces each emoji the sender cannot use with a link to its image.
 * @param content The message text.
 * @param emojis The custom emojis the text uses.
 * @param canUse Whether the sender can use an emoji for real.
 * @param link Links an emoji.
 * @returns The text with the unusable emojis linked.
 */
export function replaceEmojis(
	content: string,
	emojis: FakeEmoji[],
	canUse: (emoji: FakeEmoji) => boolean,
	link: (emoji: FakeEmoji) => string,
): string {
	return emojis
		.filter((emoji) => !canUse(emoji))
		.reduce(
			(text, emoji) => text.replace(new RegExp(`<a?:[^:>]+:${emoji.id}>`, 'g'), link(emoji)),
			content,
		);
}
