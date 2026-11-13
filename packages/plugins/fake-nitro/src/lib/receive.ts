export type ReceivedEmbed = {
	url?: string;
	image?: { url?: string };
	thumbnail?: { url?: string };
};

export type ReceivedSticker = { id: string; name: string; format_type: number };

export type ReceivedMessage = {
	content?: string;
	embeds?: ReceivedEmbed[];
	sticker_items?: ReceivedSticker[];
};

type Found = {
	kind: 'emoji' | 'sticker';
	id: string;
	extension: string;
	name?: string;
	animated: boolean;
};

const LINK =
	/(?:\[([^\]\n]*)\]\()?<?(https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(emojis|stickers)\/(\d{17,20})\.(\w+)(?:\?[^\s)>]*)?)>?(?:\))?/g;

const STICKER_FORMATS: Record<string, number> = { png: 1, gif: 4 };

function readLink(url: string): Found | undefined {
	const match = /\/(emojis|stickers)\/(\d{17,20})\.(\w+)(?:\?(\S*))?/.exec(url);

	if (!match) return;

	const [, folder, id, extension, query = ''] = match;
	const search = new URLSearchParams(query);

	return {
		kind: folder === 'emojis' ? 'emoji' : 'sticker',
		id,
		extension,
		name: search.get('name') ?? undefined,
		animated: search.get('animated') === 'true' || extension === 'gif',
	};
}

function emojiName(name: string | undefined): string {
	const cleaned = name?.replace(/~\d+$/, '').replace(/\W/g, '') ?? '';

	return cleaned.length >= 2 ? cleaned : 'emoji';
}

function embedLinks(embed: ReceivedEmbed): string[] {
	return [embed.url, embed.image?.url, embed.thumbnail?.url].filter((url): url is string =>
		Boolean(url),
	);
}

function dropEmbeds(
	embeds: ReceivedEmbed[] | undefined,
	ids: Set<string>,
): ReceivedEmbed[] | undefined {
	return embeds?.filter(
		(embed) => !embedLinks(embed).some((url) => ids.has(readLink(url)?.id ?? '')),
	);
}

/**
 * @description Shows emojis and stickers that Fake Nitro users sent as links the way they were meant: an emoji link becomes
 * the emoji, a message that is only sticker links becomes those stickers, and the links' embeds go away.
 * @param message The message as Discord received it.
 * @param options Which of emojis and stickers to turn back.
 * @returns The changed message, or `undefined` when it holds no such links.
 */
export function realExpressions<M extends ReceivedMessage>(
	message: M,
	{ emojis = true, stickers = true } = {},
): (M & ReceivedMessage) | undefined {
	const content = message.content ?? '';

	if (!content.includes('discordapp.')) return;

	const found = [...content.matchAll(LINK)].map((match) => ({ match, link: readLink(match[2]) }));
	const stickerLinks = found.filter(
		({ link }) => link?.kind === 'sticker' && STICKER_FORMATS[link.extension],
	);
	const onlyStickers =
		stickers &&
		stickerLinks.length > 0 &&
		content.replace(LINK, '').trim() === '' &&
		stickerLinks.length === found.length;
	const changed = new Set<string>();

	const text = content.replace(LINK, (whole, masked: string | undefined, url: string) => {
		const link = readLink(url);

		if (!link) return whole;

		if (link.kind === 'emoji' && emojis) {
			changed.add(link.id);

			return `<${link.animated ? 'a' : ''}:${emojiName(link.name ?? masked)}:${link.id}>`;
		}

		if (link.kind === 'sticker' && onlyStickers) {
			changed.add(link.id);

			return '';
		}

		return whole;
	});

	if (!changed.size) return;

	const stickerItems = onlyStickers
		? stickerLinks.map(({ match, link }) => ({
				id: link!.id,
				name: match[1] || 'sticker',
				format_type: STICKER_FORMATS[link!.extension],
			}))
		: [];

	return {
		...message,
		content: text.trim(),
		embeds: dropEmbeds(message.embeds, changed),
		sticker_items: [...(message.sticker_items ?? []), ...stickerItems],
	};
}
