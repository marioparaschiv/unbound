import { ACTIVITY_DOMAIN, YOUTUBE_DOMAINS } from '~/lib/constants';

export type WebViewProps = Record<string, unknown> & {
	source?: unknown;
	javaScriptEnabled?: unknown;
	injectedJavaScript?: unknown;
	injectedJavaScriptForMainFrameOnly?: unknown;
	injectedJavaScriptBeforeContentLoaded?: unknown;
	injectedJavaScriptBeforeContentLoadedForMainFrameOnly?: unknown;
	androidInjectedJavaScriptForOrigins?: unknown;
};

export type OriginScript = {
	script: string;
	allowedOriginRules: string[];
};

type WebViewSource = {
	uri?: unknown;
	html?: unknown;
	baseUrl?: unknown;
};

const YOUTUBE_PLAYER_MARKERS = [
	/(?:^|[^a-z0-9.-])(?:[a-z0-9-]+\.)*(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|iframe_api|player_api|s\/player\/)/i,
	/\bwww-widgetapi\b/i,
	/\bYT\.Player\s*\(/,
];

function hostOf(value: unknown): string | undefined {
	if (typeof value !== 'string') return;

	try {
		const url = new URL(value);

		return url.protocol === 'https:' || url.protocol === 'http:'
			? url.hostname.toLowerCase()
			: undefined;
	} catch {
		return;
	}
}

function isOnDomain(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

/**
 * @description Checks whether an address is a YouTube page, on youtube.com or youtube-nocookie.com or any of their subdomains.
 * @param value The address.
 * @returns `true` for an http or https YouTube address.
 */
export function isYoutubeUrl(value: unknown): boolean {
	const host = hostOf(value);

	return Boolean(host && YOUTUBE_DOMAINS.some((domain) => isOnDomain(host, domain)));
}

/**
 * @description Checks whether an address is a Discord activity, which Discord serves from a subdomain of discordsays.com.
 * @param value The address.
 * @returns `true` for an activity address, such as Watch Together's.
 */
export function isActivityUrl(value: unknown): boolean {
	const host = hostOf(value);

	return Boolean(host && host !== ACTIVITY_DOMAIN && isOnDomain(host, ACTIVITY_DOMAIN));
}

/**
 * @description Checks whether a page's HTML loads a YouTube player, either as a static `/embed/` frame or at runtime through YouTube's IFrame Player API.
 * @param html The HTML a `WebView` loads.
 * @returns `true` when it mentions a YouTube `/embed/` address, the `iframe_api` or `player_api` script, `www-widgetapi`, or calls `YT.Player(`.
 */
export function loadsYoutubePlayer(html: unknown): boolean {
	return typeof html === 'string' && YOUTUBE_PLAYER_MARKERS.some((marker) => marker.test(html));
}

/**
 * @description Decides whether a `WebView` can show YouTube: a YouTube page, a page that loads a YouTube player or is served as if from YouTube, or a Discord activity that may embed YouTube, such as Watch Together.
 * @param props The `WebView`'s props.
 * @returns `true` when the ad blocker should be injected into it.
 */
export function showsYoutube(props: unknown): props is WebViewProps {
	if (!props || typeof props !== 'object') return false;

	const { source, javaScriptEnabled } = props as WebViewProps;

	if (javaScriptEnabled === false || !source || typeof source !== 'object') return false;

	const { uri, html, baseUrl } = source as WebViewSource;

	return (
		isYoutubeUrl(uri) ||
		isActivityUrl(uri) ||
		(typeof html === 'string' && (isYoutubeUrl(baseUrl) || loadsYoutubePlayer(html)))
	);
}

function isScript(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function joinScripts(...scripts: string[]): string {
	return scripts.join('\n;\n');
}

function inMainFrameOnly(script: string): string {
	return `if (window === window.top) {\n${script}\n}`;
}

function beforeContentLoaded(props: WebViewProps, adblock: string): string {
	const existing = props.injectedJavaScriptBeforeContentLoaded;

	if (!isScript(existing)) return adblock;

	const existingInAllFrames =
		props.injectedJavaScriptBeforeContentLoadedForMainFrameOnly === false;

	return joinScripts(existingInAllFrames ? existing : inMainFrameOnly(existing), adblock);
}

function afterLoad(props: WebViewProps, adblock: string): string {
	const existing = props.injectedJavaScript;

	return isScript(existing) ? joinScripts(existing, adblock) : adblock;
}

/**
 * @description Lists the origin rules that match every YouTube frame, on the bare domains and their subdomains.
 * @returns Android `WebViewCompat` origin rules for youtube.com and youtube-nocookie.com.
 */
export function youtubeOriginRules(): string[] {
	return YOUTUBE_DOMAINS.flatMap((domain) => [`https://${domain}`, `https://*.${domain}`]);
}

function forYoutubeOrigins(props: WebViewProps, adblock: string): unknown {
	const existing = props.androidInjectedJavaScriptForOrigins;

	if (existing !== undefined && existing !== null) return existing;

	const originScript: OriginScript = {
		script: adblock,
		allowedOriginRules: youtubeOriginRules(),
	};

	return originScript;
}

/**
 * @description Adds the ad blocker to a `WebView`'s props, before the page's own scripts run in every frame, and again in the page once it has loaded.
 * Android only runs early scripts in the page itself, so the ad blocker is also registered for YouTube origins, which reaches the cross-origin YouTube frame inside Discord's player.
 * Scripts the `WebView` already injects keep running exactly where they ran before: one meant for the page alone is wrapped so frames skip it.
 * @param props The `WebView`'s props, which are not changed.
 * @param adblock The ad blocker from `buildAdblockScript`.
 * @returns New props with the ad blocker injected.
 */
export function withAdblock(props: WebViewProps, adblock: string): WebViewProps {
	return {
		...props,
		injectedJavaScriptBeforeContentLoaded: beforeContentLoaded(props, adblock),
		injectedJavaScriptBeforeContentLoadedForMainFrameOnly: false,
		injectedJavaScript: afterLoad(props, adblock),
		androidInjectedJavaScriptForOrigins: forYoutubeOrigins(props, adblock),
	};
}
