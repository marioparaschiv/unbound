import {
	AD_KEYS,
	DYNAMIC_AD_SELECTOR,
	HIDDEN_SELECTORS,
	SKIP_BUTTONS,
	YOUTUBE_DOMAINS,
} from '~/constants';

export const INJECTED_FLAG = '__unboundYoutubeAdblock';

const PAGE_SCRIPT = `
var domains = __DOMAINS__;
var host = String(location.hostname || '').toLowerCase();
var onYoutube = domains.some(function (domain) {
	return host === domain || host.slice(-domain.length - 1) === '.' + domain;
});
if (!onYoutube || window.__FLAG__) return;
window.__FLAG__ = true;

var adKeys = __AD_KEYS__;

function stripAds(value) {
	if (!value || typeof value !== 'object') return;
	for (var key in value) {
		if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
		if (adKeys.indexOf(key) !== -1) value[key] = [];
		else if (typeof value[key] === 'object') stripAds(value[key]);
	}
}

var nativeParse = JSON.parse;
JSON.parse = function () {
	var parsed = nativeParse.apply(JSON, arguments);
	stripAds(parsed);
	return parsed;
};

if (typeof Response !== 'undefined' && Response.prototype && Response.prototype.json) {
	var nativeJson = Response.prototype.json;
	Response.prototype.json = function () {
		return nativeJson.apply(this, arguments).then(function (parsed) {
			stripAds(parsed);
			return parsed;
		});
	};
}

function hideElements() {
	var style = document.createElement('style');
	style.textContent = __HIDDEN__.join(', ') + ' { display: none !important; }';
	(document.head || document.documentElement).appendChild(style);
}

function hideDynamicAds() {
	document.querySelectorAll(__DYNAMIC__).forEach(function (element) {
		var row = element.parentNode && element.parentNode.parentNode;
		if (row && row.localName === 'ytd-rich-item-renderer') row.style.display = 'none';
	});
}

function autoSkipAds() {
	if (!document.querySelector('.ad-showing')) return;
	var video = document.querySelector('video');
	if (!video || !video.duration) return;
	video.currentTime = video.duration;
	setTimeout(function () {
		var skip = document.querySelector(__SKIP__);
		if (skip) skip.click();
	}, 100);
}

function onDomChange() {
	hideDynamicAds();
	autoSkipAds();
}

function watchPage() {
	hideElements();
	onDomChange();
	new MutationObserver(onDomChange).observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchPage, { once: true });
else watchPage();
`;

const PLACEHOLDERS: Record<string, string> = {
	__FLAG__: INJECTED_FLAG,
	__DOMAINS__: JSON.stringify(YOUTUBE_DOMAINS),
	__AD_KEYS__: JSON.stringify(AD_KEYS),
	__HIDDEN__: JSON.stringify(HIDDEN_SELECTORS),
	__DYNAMIC__: JSON.stringify(DYNAMIC_AD_SELECTOR),
	__SKIP__: JSON.stringify(SKIP_BUTTONS.join(', ')),
};

function fillPlaceholders(source: string): string {
	return source.replace(/__[A-Z_]+__/g, (name) => PLACEHOLDERS[name] ?? name);
}

/**
 * @description Builds the ad blocker that runs inside YouTube pages: a port of the AdGuard script Vencord injects into YouTube embeds.
 * It empties the ad fields of every parsed player response, hides ad elements, and skips a video ad that still plays.
 * It runs once per page, does nothing outside youtube.com and youtube-nocookie.com, and never throws into the page.
 * @returns The script, as a string a `WebView` can inject.
 */
export function buildAdblockScript(): string {
	return `(function () {\ntry {${fillPlaceholders(PAGE_SCRIPT)}} catch (error) {}\n})();\ntrue;`;
}
