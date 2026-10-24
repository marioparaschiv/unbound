import { StickerFormat } from '~/constants';

type EmojiSheetProps = {
	emoji?: { id?: string | null; name?: string; animated?: boolean };
	emojiNode?: { src?: string; alt?: string };
};

type StickerRecord = {
	id: string;
	format_type: number;
	name?: string;
	description?: string | null;
	tags?: string;
};

type StickerFile = {
	extension: string;
	mimeType: string;
};

export type Emoji = {
	kind: 'emoji';
	id: string;
	name: string;
	animated: boolean;
};

export type Sticker = {
	kind: 'sticker';
	id: string;
	name: string;
	description: string;
	formatType: number;
	tags: string;
};

export type Expression = Emoji | Sticker;

export type ExpressionKind = Expression['kind'];

function isStickerRecord(value: object): value is StickerRecord {
	return (
		'id' in value &&
		typeof value.id === 'string' &&
		'format_type' in value &&
		typeof value.format_type === 'number'
	);
}

// UNKNOWN: sheet props and render results are Discord internals of any shape.
function findStickerRecord(value: unknown, depth: number = 0): StickerRecord | null {
	if (depth > 8 || !value || typeof value !== 'object') return null;

	if (!Array.isArray(value) && isStickerRecord(value)) return value;

	for (const child of Array.isArray(value) ? value : Object.values(value)) {
		const found = findStickerRecord(child, depth + 1);

		if (found) return found;
	}

	return null;
}

/**
 * @description Tells which expression an action sheet shows from the key it was opened with.
 * @param key The action sheet key passed to `openLazy`.
 * @returns The expression kind, or `null` for sheets about something else.
 */
export function getSheetKind(key: string): ExpressionKind | null {
	if (/emoji/i.test(key)) return 'emoji';

	if (/sticker/i.test(key)) return 'sticker';

	return null;
}

/**
 * @description Reads a custom emoji from the emoji detail sheet's props, falling back to its image URL.
 * @param props The emoji detail sheet's props.
 * @returns The emoji, or `null` for a unicode emoji.
 */
export function parseEmoji(props: EmojiSheetProps | undefined): Emoji | null {
	const match = /\/emojis\/(\d+)\.(gif|png|webp)/.exec(props?.emojiNode?.src ?? '');
	const id = props?.emoji?.id ?? match?.[1];

	if (!id) return null;

	return {
		kind: 'emoji',
		id,
		name: props?.emoji?.name ?? props?.emojiNode?.alt?.replace(/:/g, '') ?? 'emoji',
		animated: props?.emoji?.animated === true || match?.[2] === 'gif',
	};
}

/**
 * @description Finds a sticker anywhere inside a sticker sheet's props or render result.
 * @param value The value to search.
 * @returns The sticker, or `null` when none is found within 8 levels.
 */
// UNKNOWN: sheet props and render results are Discord internals of any shape.
export function parseSticker(value: unknown): Sticker | null {
	const sticker = findStickerRecord(value);

	if (!sticker) return null;

	return {
		kind: 'sticker',
		id: sticker.id,
		name: sticker.name ?? 'sticker',
		description: sticker.description ?? '',
		formatType: sticker.format_type,
		tags: sticker.tags ?? sticker.name ?? 'sticker',
	};
}

/**
 * @description Reads the expression an emoji or sticker sheet shows.
 * @param kind Which kind of sheet it is.
 * @param props The sheet's props.
 * @returns The expression, or `null` when the sheet holds none the plugin can act on.
 */
export function parseExpression(kind: ExpressionKind, props: EmojiSheetProps): Expression | null {
	return kind === 'emoji' ? parseEmoji(props) : parseSticker(props);
}

/**
 * @description Picks the file a sticker is stored as on Discord's CDN.
 * @param formatType The sticker's `format_type`.
 * @returns The file extension and its MIME type.
 */
export function getStickerFile(formatType: number): StickerFile {
	switch (formatType) {
		case StickerFormat.Lottie: {
			return { extension: 'json', mimeType: 'application/json' };
		}

		case StickerFormat.GIF: {
			return { extension: 'gif', mimeType: 'image/gif' };
		}

		default: {
			return { extension: 'png', mimeType: 'image/png' };
		}
	}
}

/**
 * @description Builds the URL of an expression's image at 160px.
 * @param expression The emoji or sticker.
 * @returns The CDN URL.
 */
export function getAssetUrl(expression: Expression): string {
	if (expression.kind === 'emoji') {
		const extension = expression.animated ? 'gif' : 'png';

		return `https://cdn.discordapp.com/emojis/${expression.id}.${extension}?size=160&quality=lossless`;
	}

	const { extension } = getStickerFile(expression.formatType);

	return `https://media.discordapp.net/stickers/${expression.id}.${extension}?size=160&quality=lossless`;
}

/**
 * @description Builds the link "Copy URL" puts on the clipboard.
 * @param expression The emoji or sticker.
 * @returns The emoji's image URL, or the sticker's page on discord.com.
 */
export function getExpressionLink(expression: Expression): string {
	if (expression.kind === 'emoji') return getAssetUrl(expression);

	return `https://discord.com/stickers/${expression.id}`;
}

/**
 * @description Builds the message markup that renders an emoji.
 * @param emoji The custom emoji.
 * @returns Markup such as `<a:name:id>`.
 */
export function getEmojiMarkup(emoji: Emoji): string {
	return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

export default {
	getSheetKind,
	parseEmoji,
	parseSticker,
	parseExpression,
	getStickerFile,
	getAssetUrl,
	getExpressionLink,
	getEmojiMarkup,
};
