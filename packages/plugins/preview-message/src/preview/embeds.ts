import { SizeFields, TextFields } from '~/constants';

type EmbedMedia = {
	url?: string;
	proxy_url?: string;
	width?: number;
	height?: number;
};

type EmbedProvider = {
	name?: string;
	url?: string;
};

type MediaKey = 'image' | 'thumbnail' | 'video';

export type LinkEmbed = {
	type?: string;
	url: string;
	title?: string;
	description?: string;
	provider?: EmbedProvider;
} & Partial<Record<MediaKey, EmbedMedia>>;

type EmbedText = {
	name?: string;
	text?: string;
	value?: string;
	timestamp?: string;
};

// Discord's unfurler also returns the fields after `description`, which the preview drops.
type ResolvedEmbed = {
	type?: string;
	url?: string;
	title?: string;
	description?: string;
	timestamp?: string;
	provider?: EmbedProvider;
	author?: EmbedText;
	footer?: EmbedText;
	fields?: EmbedText[];
} & Partial<Record<MediaKey, EmbedMedia | null>>;

type UnfurlRequest = {
	url: string;
	body: { urls: string[] };
};

type UnfurlResponse = {
	body?: { embeds?: ResolvedEmbed[] };
};

export type EmbedResolver = {
	post: (request: UnfurlRequest) => Promise<UnfurlResponse>;
};

type OpenGraph = {
	title?: string;
	description?: string;
	siteName?: string;
	type?: string;
	image?: string;
	imageWidth?: number;
	imageHeight?: number;
};

function decodeHtml(value: string): string {
	return value
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&#x([\da-f]+);/gi, (_match, code: string) =>
			String.fromCodePoint(Number.parseInt(code, 16)),
		);
}

function clean(value: string | undefined): string | undefined {
	return (value && decodeHtml(value).replace(/\s+/g, ' ').trim()) || undefined;
}

function parseAttributes(tag: string): Map<string, string> {
	const attributes = new Map<string, string>();

	for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
		attributes.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4]));
	}

	return attributes;
}

function readSize(value: string): number | undefined {
	const size = Number.parseInt(value, 10);

	return size > 0 ? size : undefined;
}

function resolveUrl(value: string | undefined, base: string): string | undefined {
	if (!value) return undefined;

	try {
		return new URL(value, base).toString();
	} catch {
		return undefined;
	}
}

function readOpenGraph(html: string): OpenGraph {
	const metadata: OpenGraph = {};

	for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attributes = parseAttributes(tag);
		const key = (attributes.get('property') ?? attributes.get('name') ?? '').toLowerCase();
		const value = clean(attributes.get('content'));
		const textField = TextFields.get(key);
		const sizeField = SizeFields.get(key);

		if (!value) {
			continue;
		}

		if (textField) {
			metadata[textField] ??= value;
		} else if (sizeField) {
			metadata[sizeField] ??= readSize(value);
		}
	}

	return metadata;
}

function pickMedia(media: EmbedMedia | null | undefined): EmbedMedia | undefined {
	if (!media || typeof media !== 'object' || Array.isArray(media)) return undefined;

	const picked: EmbedMedia = {};

	if (typeof media.url === 'string') {
		picked.url = media.url;
	}

	if (typeof media.proxy_url === 'string') {
		picked.proxy_url = media.proxy_url;
	}

	if (Number.isFinite(media.width)) {
		picked.width = media.width;
	}

	if (Number.isFinite(media.height)) {
		picked.height = media.height;
	}

	return Object.keys(picked).length ? picked : undefined;
}

/**
 * @description Finds the links a message would embed, skipping `<suppressed>` links and trailing punctuation.
 * @param content The message content.
 * @returns The unique links, in order of appearance.
 */
export function extractUrls(content: string): string[] {
	const urls = new Set<string>();

	for (const match of content.matchAll(/https?:\/\/[^\s<>()"']+/gi)) {
		const start = match.index;
		const end = start + match[0].length;

		if (content[start - 1] === '<' && content[end] === '>') {
			continue;
		}

		let url = match[0].replace(/[.,!;:?]+$/, '');

		while (url.endsWith(')') && url.split('(').length < url.split(')').length) {
			url = url.slice(0, -1);
		}

		if (url) {
			urls.add(url);
		}
	}

	return [...urls];
}

/**
 * @description Builds a link embed from a page's Open Graph and Twitter card tags, falling back to its `<title>`.
 * @param html The page's HTML.
 * @param sourceUrl The page's URL, used for the embed and to resolve a relative image.
 * @returns The embed, or `null` when the page has no title, description or image.
 */
export function parseOpenGraph(html: string, sourceUrl: string): LinkEmbed | null {
	const metadata = readOpenGraph(html);
	const title = metadata.title ?? clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
	const image = resolveUrl(metadata.image, sourceUrl);
	const { description, siteName } = metadata;

	if (!title && !description && !image) return null;

	const imageOnly = metadata.type === 'image' && image && !title && !description;
	const embed: LinkEmbed = { type: imageOnly ? 'image' : 'article', url: sourceUrl };

	if (title) {
		embed.title = title;
	}

	if (description) {
		embed.description = description;
	}

	if (siteName) {
		embed.provider = { name: siteName, url: sourceUrl };
	}

	if (image) {
		embed.image = { url: image, width: metadata.imageWidth, height: metadata.imageHeight };
	}

	return embed;
}

/**
 * @description Keeps only the fields of a Discord unfurler embed that the message row renders safely.
 * @param embed One embed from Discord's response.
 * @param url The link it was resolved for, used when the embed has no URL.
 * @returns The embed, or `null` when it has nothing to show.
 */
export function normalizeDiscordEmbed(
	embed: ResolvedEmbed | null | undefined,
	url: string,
): LinkEmbed | null {
	if (!embed || typeof embed !== 'object' || Array.isArray(embed)) return null;

	const { type, title, description } = embed;

	if (
		typeof type !== 'string' &&
		typeof title !== 'string' &&
		typeof description !== 'string' &&
		!embed.image &&
		!embed.thumbnail &&
		!embed.video
	) {
		return null;
	}

	const normalized: LinkEmbed = { url: typeof embed.url === 'string' ? embed.url : url };

	if ('type' in embed) {
		normalized.type = type;
	}

	if ('title' in embed) {
		normalized.title = title;
	}

	if ('description' in embed) {
		normalized.description = description;
	}

	for (const key of ['image', 'thumbnail', 'video'] as const) {
		const media = pickMedia(embed[key]);

		if (media) {
			normalized[key] = media;
		}
	}

	return normalized;
}

/**
 * @description Resolves a link's embed through Discord's unfurler, or from the page's own metadata when that fails.
 * @param url The link.
 * @param resolver Discord's REST client.
 * @returns The embed, or `null` when neither source produced one.
 */
export async function fetchLinkEmbed(
	url: string,
	resolver: EmbedResolver,
): Promise<LinkEmbed | null> {
	try {
		const result = await resolver.post({ url: '/unfurler/embed-urls', body: { urls: [url] } });

		return normalizeDiscordEmbed(result?.body?.embeds?.[0], url);
	} catch {
		// Discord could not resolve it, so read the page instead.
	}

	try {
		const response = await fetch(url, {
			headers: { Accept: 'text/html,application/xhtml+xml' },
		});

		return response.ok ? parseOpenGraph(await response.text(), url) : null;
	} catch {
		return null;
	}
}

export default { extractUrls, parseOpenGraph, normalizeDiscordEmbed, fetchLinkEmbed };
