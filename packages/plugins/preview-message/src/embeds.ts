export type LinkEmbed = {
	type?: string;
	url: string;
	title?: string;
	description?: string;
	provider?: { name?: string; url?: string };
	image?: { url?: string; width?: number; height?: number; proxy_url?: string };
	thumbnail?: { url?: string; width?: number; height?: number; proxy_url?: string };
	video?: { url?: string; width?: number; height?: number; proxy_url?: string };
	[key: string]: unknown;
};

type EmbedRequest = {
	post?: (options: {
		url: string;
		body: { urls: string[] };
	}) => Promise<{ body?: { embeds?: unknown[] } }>;
};

const EMBED_KEYS = ['type', 'title', 'description'] as const;

type OpenGraphMetadata = {
	title?: string;
	description?: string;
	siteName?: string;
	type?: string;
	image?: string;
	imageWidth?: number;
	imageHeight?: number;
};

const URL_PATTERN = /https?:\/\/[^\s<>()"']+/gi;
const META_TAG_PATTERN = /<meta\b[^>]*>/gi;
const ATTRIBUTE_PATTERN = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const TITLE_PATTERN = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

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

function cleanValue(value: string | undefined): string | undefined {
	const cleaned = value ? decodeHtml(value).replace(/\s+/g, ' ').trim() : '';
	return cleaned || undefined;
}

function parseAttributes(tag: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
		const value = match[2] ?? match[3] ?? match[4];
		if (value !== undefined) attributes[match[1].toLowerCase()] = decodeHtml(value);
	}
	return attributes;
}

function readNumber(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveUrl(value: string | undefined, sourceUrl: string): string | undefined {
	if (!value) return undefined;
	try {
		return new URL(value, sourceUrl).toString();
	} catch {
		return undefined;
	}
}

function normalizeMedia(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const media = value as Record<string, unknown>;
	const normalized: Record<string, unknown> = {};
	if (typeof media.url === 'string') normalized.url = media.url;
	if (typeof media.proxy_url === 'string') normalized.proxy_url = media.proxy_url;
	if (typeof media.width === 'number' && Number.isFinite(media.width))
		normalized.width = media.width;
	if (typeof media.height === 'number' && Number.isFinite(media.height))
		normalized.height = media.height;
	return Object.keys(normalized).length ? normalized : undefined;
}

export function extractUrls(content: string): string[] {
	const urls = new Set<string>();
	for (const match of content.matchAll(URL_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (content[start - 1] === '<' && content[end] === '>') continue;

		let url = match[0].replace(/[.,!;:?]+$/, '');
		while (
			url.endsWith(')') &&
			(url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
		)
			url = url.slice(0, -1);
		if (url) urls.add(url);
	}
	return [...urls];
}

export function parseOpenGraph(html: string, sourceUrl: string): LinkEmbed | null {
	const metadata: OpenGraphMetadata = {};
	for (const tag of html.matchAll(META_TAG_PATTERN)) {
		const attributes = parseAttributes(tag[0]);
		const key = (attributes.property ?? attributes.name ?? '').toLowerCase();
		const value = cleanValue(attributes.content);
		if (!key || !value) continue;

		switch (key) {
			case 'og:title':
			case 'twitter:title':
				metadata.title ??= value;
				break;
			case 'og:description':
			case 'twitter:description':
				metadata.description ??= value;
				break;
			case 'og:site_name':
				metadata.siteName ??= value;
				break;
			case 'og:type':
				metadata.type ??= value;
				break;
			case 'og:image':
			case 'og:image:url':
			case 'og:image:secure_url':
			case 'twitter:image':
				metadata.image ??= value;
				break;
			case 'og:image:width':
			case 'twitter:image:width':
				metadata.imageWidth ??= readNumber(value);
				break;
			case 'og:image:height':
			case 'twitter:image:height':
				metadata.imageHeight ??= readNumber(value);
				break;
		}
	}

	const title = metadata.title ?? cleanValue(html.match(TITLE_PATTERN)?.[1]);
	const image = resolveUrl(metadata.image, sourceUrl);
	if (!title && !metadata.description && !image) return null;

	const embed: LinkEmbed = {
		type:
			metadata.type === 'image' && image && !title && !metadata.description
				? 'image'
				: 'article',
		url: sourceUrl,
	};
	if (title) embed.title = title;
	if (metadata.description) embed.description = metadata.description;
	if (metadata.siteName) embed.provider = { name: metadata.siteName, url: sourceUrl };
	if (image)
		embed.image = { url: image, width: metadata.imageWidth, height: metadata.imageHeight };
	return embed;
}

export function normalizeDiscordEmbed(value: unknown, url: string): LinkEmbed | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const embed = value as Record<string, unknown>;
	if (
		typeof embed.type !== 'string' &&
		typeof embed.title !== 'string' &&
		typeof embed.description !== 'string' &&
		!embed.image &&
		!embed.thumbnail &&
		!embed.video
	)
		return null;
	const normalized: Record<string, unknown> = {
		url: typeof embed.url === 'string' ? embed.url : url,
	};
	for (const key of EMBED_KEYS) {
		if (!(key in embed) || key === 'image' || key === 'thumbnail' || key === 'video') continue;
		normalized[key] = embed[key];
	}
	for (const key of ['image', 'thumbnail', 'video']) {
		const media = normalizeMedia(embed[key]);
		if (media) normalized[key] = media;
	}
	return normalized as LinkEmbed;
}

export async function fetchLinkEmbed(
	url: string,
	request?: EmbedRequest | null,
): Promise<LinkEmbed | null> {
	if (typeof request?.post === 'function') {
		try {
			const result = await request.post({
				url: '/unfurler/embed-urls',
				body: { urls: [url] },
			});
			return normalizeDiscordEmbed(result?.body?.embeds?.[0], url);
		} catch {}
	}

	try {
		const response = await fetch(url, {
			headers: { Accept: 'text/html,application/xhtml+xml' },
		});
		if (!response.ok) return null;
		const html = await response.text();
		return parseOpenGraph(html, url);
	} catch {
		return null;
	}
}
