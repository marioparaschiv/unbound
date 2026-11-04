import { PLAYER_ORIGIN } from '~/constants';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com',
]);
const ID_PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

function isVideoId(value: string): boolean {
	return VIDEO_ID.test(value);
}

function idFromUrl(url: URL): string | undefined {
	const host = url.hostname.toLowerCase();
	const segments = url.pathname.split('/').filter(Boolean);

	if (host === 'youtu.be') return segments[0];

	if (!YOUTUBE_HOSTS.has(host)) return;

	if (segments[0] === 'watch') return url.searchParams.get('v') ?? undefined;

	if (ID_PATH_PREFIXES.includes(segments[0] ?? '')) return segments[1];
}

function parseUrl(value: string): URL | undefined {
	try {
		return new URL(value);
	} catch {
		return;
	}
}

/**
 * @description Reads a YouTube video id from a bare id or from a YouTube watch, share, embed or Shorts link.
 * @param value The id or link, as Discord passes it.
 * @returns The 11-character video id, or `undefined` when the value names no YouTube video.
 */
export function toVideoId(value: unknown): string | undefined {
	if (typeof value !== 'string') return;

	const trimmed = value.trim();

	if (isVideoId(trimmed)) return trimmed;

	const url = parseUrl(trimmed);
	const id = url && idFromUrl(url);

	return id && isVideoId(id) ? id : undefined;
}

/**
 * @description Builds the YouTube embed address the fallback player loads.
 * @param videoId A video id from {@link toVideoId}.
 * @returns The embed URL, which plays inline, suggests related videos from the same channel only and takes iframe API commands from the player page.
 */
export function embedUrl(videoId: string): string {
	const url = new URL(`/embed/${encodeURIComponent(videoId)}`, PLAYER_ORIGIN);

	url.searchParams.set('playsinline', '1');
	url.searchParams.set('rel', '0');
	url.searchParams.set('enablejsapi', '1');
	url.searchParams.set('origin', PLAYER_ORIGIN);

	return url.toString();
}

/**
 * @description Builds the page the fallback player shows: the YouTube embed filling the view, served from youtube-nocookie.com so YouTube neither applies its per-site embed block nor rejects the page for claiming to be youtube.com (error 152).
 * @param videoId A video id from {@link toVideoId}.
 * @returns The page's HTML.
 */
export function playerHtml(videoId: string): string {
	return [
		'<!doctype html>',
		'<html><head>',
		'<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">',
		'<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>',
		'</head><body>',
		`<iframe src="${embedUrl(videoId)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`,
		'</body></html>',
	].join('');
}

/**
 * @description Decides whether a navigation stays in the fallback player or leaves it.
 * The player page, its YouTube frame and anything loading inside that frame stay; a link that would replace the page, such as **Watch on YouTube**, leaves.
 * @param url The address being loaded.
 * @param isTopFrame Whether it loads in the page itself rather than in a frame; Android only asks for the page, so it passes `true` or nothing.
 * @returns `true` to load it in the player, `false` to open it outside Discord.
 */
export function staysInPlayer(url: string, isTopFrame: boolean | undefined): boolean {
	if (isTopFrame === false) return true;

	if (url.startsWith('about:') || url.startsWith('data:')) return true;

	const parsed = parseUrl(url);

	return parsed?.origin === PLAYER_ORIGIN && (parsed.pathname === '/' || parsed.pathname === '');
}

const PAUSE_COMMAND = JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] });

/**
 * @description Builds the script the fallback player injects into its page to pause the video, through the YouTube iframe API's `postMessage` commands.
 * @returns The script, which ends in `true` as `injectJavaScript` expects.
 */
export function pauseScript(): string {
	return [
		'(function(){',
		"var frame=document.querySelector('iframe');",
		`if(frame&&frame.contentWindow)frame.contentWindow.postMessage(${JSON.stringify(PAUSE_COMMAND)},${JSON.stringify(PLAYER_ORIGIN)});`,
		'})();true;',
	].join('');
}
