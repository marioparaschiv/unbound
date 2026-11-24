({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=function(){"use strict";var YOUTUBE_DOMAINS=["youtube.com","youtube-nocookie.com"],ACTIVITY_DOMAIN="discordsays.com",YOUTUBE_PLAYER_MARKERS=[/(?:^|[^a-z0-9.-])(?:[a-z0-9-]+\.)*(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|iframe_api|player_api|s\/player\/)/i,/\bwww-widgetapi\b/i,/\bYT\.Player\s*\(/];function hostOf(value){if("string"==typeof value)try{var url=new URL(value);return"https:"===url.protocol||"http:"===url.protocol?url.hostname.toLowerCase():void 0}catch(unused){return}}function isOnDomain(host,domain){return host===domain||host.endsWith(`.${domain}`)}function isYoutubeUrl(value){var host=hostOf(value);return!!(host&&YOUTUBE_DOMAINS.some(domain=>isOnDomain(host,domain)))}function isActivityUrl(value){var host=hostOf(value);return!!(host&&host!==ACTIVITY_DOMAIN&&isOnDomain(host,ACTIVITY_DOMAIN))}function loadsYoutubePlayer(html){return"string"==typeof html&&YOUTUBE_PLAYER_MARKERS.some(marker=>marker.test(html))}function showsYoutube(props){if(!props||"object"!=typeof props)return!1;var{source,javaScriptEnabled}=props;if(!1===javaScriptEnabled||!source||"object"!=typeof source)return!1;var{uri,html,baseUrl}=source;return isYoutubeUrl(uri)||isActivityUrl(uri)||"string"==typeof html&&(isYoutubeUrl(baseUrl)||loadsYoutubePlayer(html))}function isScript(value){return"string"==typeof value&&value.trim().length>0}function joinScripts(...scripts){return scripts.join("\n;\n")}function inMainFrameOnly(script){return`if (window === window.top) {
${script}
}`}function beforeContentLoaded(props,adblock){var existing=props.injectedJavaScriptBeforeContentLoaded;return isScript(existing)?joinScripts(!1===props.injectedJavaScriptBeforeContentLoadedForMainFrameOnly?existing:inMainFrameOnly(existing),adblock):adblock}function afterLoad(props,adblock){var existing=props.injectedJavaScript;return isScript(existing)?joinScripts(existing,adblock):adblock}function youtubeOriginRules(){return YOUTUBE_DOMAINS.flatMap(domain=>[`https://${domain}`,`https://*.${domain}`])}function forYoutubeOrigins(props,adblock){var existing=props.androidInjectedJavaScriptForOrigins;return null!=existing?existing:{script:adblock,allowedOriginRules:youtubeOriginRules()}}function withAdblock(props,adblock){return{...props,injectedJavaScriptBeforeContentLoaded:beforeContentLoaded(props,adblock),injectedJavaScriptBeforeContentLoadedForMainFrameOnly:!1,injectedJavaScript:afterLoad(props,adblock),androidInjectedJavaScriptForOrigins:forYoutubeOrigins(props,adblock)}}var PAGE_SCRIPT=`
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
`,PLACEHOLDERS={__FLAG__:"__unboundYoutubeAdblock",__DOMAINS__:JSON.stringify(YOUTUBE_DOMAINS),__AD_KEYS__:JSON.stringify(["adPlacements","playerAds","adSlots"]),__HIDDEN__:JSON.stringify(["#__ffYoutube1","#__ffYoutube2","#__ffYoutube3","#__ffYoutube4","#feed-pyv-container","#feedmodule-PRO","#homepage-chrome-side-promo","#merch-shelf","#offer-module",'#pla-shelf > ytd-pla-shelf-renderer[class="style-scope ytd-watch"]',"#pla-shelf","#premium-yva","#promo-info","#promo-list","#promotion-shelf","#related > ytd-watch-next-secondary-results-renderer > #items > ytd-compact-promoted-video-renderer.ytd-watch-next-secondary-results-renderer","#search-pva","#shelf-pyv-container","#video-masthead","#watch-branded-actions","#watch-buy-urls","#watch-channel-brand-div","#watch7-branded-banner","#YtKevlarVisibilityIdentifier","#YtSparklesVisibilityIdentifier",".carousel-offer-url-container",".companion-ad-container",".GoogleActiveViewElement",'.list-view[style="margin: 7px 0pt;"]',".promoted-sparkles-text-search-root-container",".promoted-videos",".searchView.list-view",".sparkles-light-cta",".watch-extra-info-column",".watch-extra-info-right",".ytd-carousel-ad-renderer",".ytd-compact-promoted-video-renderer",".ytd-companion-slot-renderer",".ytd-merch-shelf-renderer",".ytd-player-legacy-desktop-watch-ads-renderer",".ytd-promoted-sparkles-text-search-renderer",".ytd-promoted-video-renderer",".ytd-search-pyv-renderer",".ytd-video-masthead-ad-v3-renderer",".ytp-ad-action-interstitial-background-container",".ytp-ad-action-interstitial-slot",".ytp-ad-image-overlay",".ytp-ad-overlay-container",".ytp-ad-progress",".ytp-ad-progress-list",'[class*="ytd-display-ad-"]','[layout*="display-ad-"]','a[href^="http://www.youtube.com/cthru?"]','a[href^="https://www.youtube.com/cthru?"]',"ytd-action-companion-ad-renderer","ytd-banner-promo-renderer","ytd-compact-promoted-video-renderer","ytd-companion-slot-renderer","ytd-display-ad-renderer","ytd-promoted-sparkles-text-search-renderer","ytd-promoted-sparkles-web-renderer","ytd-search-pyv-renderer","ytd-single-option-survey-renderer","ytd-video-masthead-ad-advertiser-info-renderer","ytd-video-masthead-ad-v3-renderer","YTM-PROMOTED-VIDEO-RENDERER"]),__DYNAMIC__:JSON.stringify("#contents > ytd-rich-item-renderer ytd-display-ad-renderer"),__SKIP__:JSON.stringify("button.ytp-ad-skip-button, button.ytp-ad-skip-button-modern, button.ytp-skip-ad-button")};function fillPlaceholders(source){return source.replace(/__[A-Z_]+__/g,name=>PLACEHOLDERS[name]??name)}function buildAdblockScript(){return`(function () {
try {${fillPlaceholders(PAGE_SCRIPT)}} catch (error) {}
})();
true;`}function patchWebView(){var WebViewModule=unbound.metro.findByProps("WebView");if(!WebViewModule)return void logger.warn("WebView ad blocker skipped: Discord moved WebViewModule.");var webView=WebViewModule.WebView;if(!webView)return void logger.warn("WebView ad blocker skipped: WebView has no render function.");if(webView.prototype?.isReactComponent)return void logger.warn("WebView ad blocker skipped: WebView is a class component.");var adblock=buildAdblockScript();unbound.patcher.react.before(WebViewModule,"WebView",({props})=>{if(showsYoutube(props))return withAdblock(props,adblock)})}return{start:function start(){patchWebView()},stop:function stop(){unbound.patcher.unpatchAll()}}}();return this.__plugin;}})