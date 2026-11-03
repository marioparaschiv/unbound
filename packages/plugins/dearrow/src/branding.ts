import { BRANDING_URL, THUMBNAIL_URL } from '~/constants';

export type Branding = {
	title?: string;
	thumbnail?: string;
};

type BrandingTitle = {
	title?: unknown;
	votes?: unknown;
};

type BrandingThumbnail = {
	timestamp?: unknown;
	votes?: unknown;
	original?: unknown;
};

type BrandingResponse = {
	titles?: unknown;
	thumbnails?: unknown;
};

type EmbedLike = {
	url?: unknown;
	provider?: { name?: unknown } | null;
	video?: { url?: unknown } | null;
};

const VIDEO_ID = /^[\w-]{11}$/;
const EMBED_PATH = /^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:[/?#]|$)/;

function hasVotes(entry: { votes?: unknown } | undefined): boolean {
	return typeof entry?.votes === 'number' && entry.votes >= 0;
}

function firstEntry<T>(list: unknown): T | undefined {
	return Array.isArray(list) ? (list[0] as T | undefined) : undefined;
}

/**
 * @description Reads the YouTube video id from a URL: embed, watch, shorts, live and `youtu.be` links.
 * @param value The URL to read.
 * @returns The 11-character video id, or `undefined` when the URL is not a YouTube video.
 */
export function videoIdFromUrl(value: unknown): string | undefined {
	if (typeof value !== 'string') return;

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return;
	}

	const host = url.hostname.replace(/^(?:www|m|music)\./, '');

	if (host === 'youtu.be') {
		const id = url.pathname.slice(1).split('/')[0];

		return id && VIDEO_ID.test(id) ? id : undefined;
	}

	if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return;

	const fromPath = EMBED_PATH.exec(url.pathname)?.[1];

	if (fromPath) return fromPath;

	const fromQuery = url.pathname === '/watch' ? url.searchParams.get('v') : null;

	return fromQuery && VIDEO_ID.test(fromQuery) ? fromQuery : undefined;
}

/**
 * @description Reads the video id of a YouTube embed, from its video URL first and its link second.
 * @param embed A message embed record.
 * @returns The video id, or `undefined` when the embed is not a YouTube video.
 */
export function embedVideoId(embed: EmbedLike | null | undefined): string | undefined {
	if (!embed || embed.provider?.name !== 'YouTube') return;

	return videoIdFromUrl(embed.video?.url) ?? videoIdFromUrl(embed.url);
}

/**
 * @description Removes the `>` DeArrow submitters put before a word to keep its original casing.
 * @param title The submitted title.
 * @returns The title as it should be shown.
 */
export function cleanTitle(title: string): string {
	return title.replace(/(^|\s)>(\S)/g, '$1$2');
}

/**
 * @description Builds the URL of the DeArrow thumbnail taken at a time in the video.
 * @param videoId The YouTube video id.
 * @param timestamp The time in seconds the thumbnail is taken at.
 * @returns The thumbnail URL.
 */
export function thumbnailUrl(videoId: string, timestamp: number): string {
	const query = new URLSearchParams({ videoID: videoId, time: String(timestamp) });

	return `${THUMBNAIL_URL}?${query.toString()}`;
}

/**
 * @description Builds the URL the branding of a video is fetched from.
 * @param videoId The YouTube video id.
 * @returns The branding API URL.
 */
export function brandingUrl(videoId: string): string {
	return `${BRANDING_URL}?${new URLSearchParams({ videoID: videoId }).toString()}`;
}

/**
 * @description Picks the community title and thumbnail from a DeArrow branding response, as Vencord does: the top entry when its votes are not negative, and a thumbnail only when it is not the original one.
 * @param videoId The YouTube video id the response is for.
 * @param response The parsed JSON the branding API returned.
 * @returns The replacements, or `null` when DeArrow has neither.
 */
export function parseBranding(videoId: string, response: unknown): Branding | null {
	if (!response || typeof response !== 'object') return null;

	const { titles, thumbnails } = response as BrandingResponse;
	const title = firstEntry<BrandingTitle>(titles);
	const thumbnail = firstEntry<BrandingThumbnail>(thumbnails);
	const branding: Branding = {};

	if (hasVotes(title) && typeof title?.title === 'string' && title.title.trim()) {
		branding.title = cleanTitle(title.title);
	}

	if (
		hasVotes(thumbnail) &&
		!thumbnail?.original &&
		typeof thumbnail?.timestamp === 'number' &&
		Number.isFinite(thumbnail.timestamp)
	) {
		branding.thumbnail = thumbnailUrl(videoId, thumbnail.timestamp);
	}

	return branding.title || branding.thumbnail ? branding : null;
}
