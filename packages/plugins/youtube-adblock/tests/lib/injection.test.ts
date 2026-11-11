import { describe, expect, test } from 'bun:test';

import {
	isActivityUrl,
	isYoutubeUrl,
	loadsYoutubePlayer,
	showsYoutube,
	withAdblock,
	youtubeOriginRules,
} from '~/lib/injection';

const ADBLOCK = 'adblock();';

describe('isYoutubeUrl', () => {
	test('accepts YouTube pages', () => {
		expect(isYoutubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
		expect(isYoutubeUrl('https://youtube.com/')).toBe(true);
		expect(isYoutubeUrl('https://m.youtube.com/watch?v=x')).toBe(true);
		expect(isYoutubeUrl('https://www.youtube-nocookie.com/embed/x')).toBe(true);
		expect(isYoutubeUrl('http://WWW.YOUTUBE.COM/')).toBe(true);
	});

	test('rejects everything else', () => {
		expect(isYoutubeUrl('https://youtube.com.evil.test/')).toBe(false);
		expect(isYoutubeUrl('https://notyoutube.com/')).toBe(false);
		expect(isYoutubeUrl('https://youtu.be/x')).toBe(false);
		expect(isYoutubeUrl('javascript://youtube.com/')).toBe(false);
		expect(isYoutubeUrl('not a url')).toBe(false);
		expect(isYoutubeUrl(undefined)).toBe(false);
		expect(isYoutubeUrl(42)).toBe(false);
	});
});

describe('isActivityUrl', () => {
	test('accepts activity subdomains', () => {
		expect(isActivityUrl('https://880218394199220334.discordsays.com/')).toBe(true);
		expect(isActivityUrl('https://880218394199220334.discordsays.com/?instance_id=1')).toBe(
			true,
		);
	});

	test('rejects the bare domain and look-alikes', () => {
		expect(isActivityUrl('https://discordsays.com/')).toBe(false);
		expect(isActivityUrl('https://x.discordsays.com.evil.test/')).toBe(false);
		expect(isActivityUrl('https://discord.com/')).toBe(false);
	});
});

const IFRAME_API_PAGE = `<div id="player"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
function onYouTubeIframeAPIReady() {
	new YT.Player('player', { videoId: 'dQw4w9WgXcQ' });
}
</script>`;

describe('loadsYoutubePlayer', () => {
	test('finds a static YouTube embed frame', () => {
		expect(
			loadsYoutubePlayer('<iframe src="https://www.youtube.com/embed/x?a=1"></iframe>'),
		).toBe(true);
		expect(loadsYoutubePlayer("<iframe src='//www.youtube-nocookie.com/embed/x'>")).toBe(true);
		expect(loadsYoutubePlayer('<iframe src=https://youtube.com/embed/x>')).toBe(true);
	});

	test('finds a player built at runtime with the IFrame Player API', () => {
		expect(loadsYoutubePlayer(IFRAME_API_PAGE)).toBe(true);
		expect(loadsYoutubePlayer('<script src="//www.youtube.com/player_api"></script>')).toBe(
			true,
		);
		expect(
			loadsYoutubePlayer(
				'<script src="https://www.youtube.com/s/player/abc/www-widgetapi.vflset/www-widgetapi.js">',
			),
		).toBe(true);
		expect(loadsYoutubePlayer('<script>window.p = new YT.Player(el, opts);</script>')).toBe(
			true,
		);
		expect(loadsYoutubePlayer("const url = 'https://www.youtube.com/embed/' + id;")).toBe(true);
	});

	test('ignores pages without one', () => {
		expect(loadsYoutubePlayer('<iframe src="https://player.vimeo.com/video/1">')).toBe(false);
		expect(loadsYoutubePlayer('<iframe src="https://www.youtube.com/watch?v=x">')).toBe(false);
		expect(loadsYoutubePlayer('<iframe src="https://notyoutube.com/embed/x">')).toBe(false);
		expect(loadsYoutubePlayer('<p>YT.Playerless</p>')).toBe(false);
		expect(loadsYoutubePlayer(undefined)).toBe(false);
	});
});

describe('showsYoutube', () => {
	test('matches YouTube pages, framed embeds and activities', () => {
		expect(showsYoutube({ source: { uri: 'https://www.youtube.com/embed/x' } })).toBe(true);
		expect(
			showsYoutube({ source: { html: '<p></p>', baseUrl: 'https://www.youtube.com/' } }),
		).toBe(true);
		expect(
			showsYoutube({ source: { html: '<iframe src="https://www.youtube.com/embed/x">' } }),
		).toBe(true);
		expect(
			showsYoutube({ source: { uri: 'https://880218394199220334.discordsays.com/' } }),
		).toBe(true);
	});

	test('matches an IFrame Player API page served from a non-YouTube base address', () => {
		expect(
			showsYoutube({ source: { html: IFRAME_API_PAGE, baseUrl: 'https://discord.com/' } }),
		).toBe(true);
		expect(showsYoutube({ source: { html: IFRAME_API_PAGE, baseUrl: 'about:blank' } })).toBe(
			true,
		);
		expect(showsYoutube({ source: { html: IFRAME_API_PAGE } })).toBe(true);
	});

	test('leaves other WebViews alone', () => {
		expect(showsYoutube({ source: { uri: 'https://discord.com/login' } })).toBe(false);
		expect(showsYoutube({ source: { html: '<p></p>', baseUrl: 'https://discord.com/' } })).toBe(
			false,
		);
		expect(showsYoutube({ source: { baseUrl: 'https://www.youtube.com/' } })).toBe(false);
		expect(
			showsYoutube({ source: { uri: 'https://www.youtube.com/' }, javaScriptEnabled: false }),
		).toBe(false);
		expect(showsYoutube({ source: 'https://www.youtube.com/' })).toBe(false);
		expect(showsYoutube({})).toBe(false);
		expect(showsYoutube(null)).toBe(false);
	});
});

describe('withAdblock', () => {
	test('injects into every frame before load and into the page after load', () => {
		const props = { source: { uri: 'https://www.youtube.com/embed/x' } };
		const result = withAdblock(props, ADBLOCK);

		expect(result.injectedJavaScriptBeforeContentLoaded).toBe(ADBLOCK);
		expect(result.injectedJavaScriptBeforeContentLoadedForMainFrameOnly).toBe(false);
		expect(result.injectedJavaScript).toBe(ADBLOCK);
		expect(result.injectedJavaScriptForMainFrameOnly).toBeUndefined();
		expect(result.source).toBe(props.source);
	});

	test('registers the ad blocker for YouTube origins on Android', () => {
		const result = withAdblock({ source: { html: '<p></p>' } }, ADBLOCK);

		expect(result.androidInjectedJavaScriptForOrigins).toEqual({
			script: ADBLOCK,
			allowedOriginRules: [
				'https://youtube.com',
				'https://*.youtube.com',
				'https://youtube-nocookie.com',
				'https://*.youtube-nocookie.com',
			],
		});
		expect(youtubeOriginRules()).toHaveLength(4);
	});

	test('keeps an origin script the WebView already registers', () => {
		const own = { script: 'own();', allowedOriginRules: ['https://example.com'] };
		const result = withAdblock({ androidInjectedJavaScriptForOrigins: own }, ADBLOCK);

		expect(result.androidInjectedJavaScriptForOrigins).toBe(own);
	});

	test('does not change the props it was given', () => {
		const props = { source: { uri: 'https://www.youtube.com/' }, injectedJavaScript: 'own();' };

		withAdblock(props, ADBLOCK);

		expect(props).toEqual({
			source: { uri: 'https://www.youtube.com/' },
			injectedJavaScript: 'own();',
		});
	});

	test('keeps a page-only early script in the page', () => {
		const result = withAdblock({ injectedJavaScriptBeforeContentLoaded: 'bridge();' }, ADBLOCK);
		const script = String(result.injectedJavaScriptBeforeContentLoaded);

		expect(script).toContain('if (window === window.top) {\nbridge();\n}');
		expect(script.endsWith(ADBLOCK)).toBe(true);
		expect(result.injectedJavaScriptBeforeContentLoadedForMainFrameOnly).toBe(false);
	});

	test('keeps an all-frames early script in all frames', () => {
		const result = withAdblock(
			{
				injectedJavaScriptBeforeContentLoaded: 'bridge();',
				injectedJavaScriptBeforeContentLoadedForMainFrameOnly: false,
			},
			ADBLOCK,
		);

		expect(result.injectedJavaScriptBeforeContentLoaded).toBe(`bridge();\n;\n${ADBLOCK}`);
	});

	test('runs after the page script it already has', () => {
		const result = withAdblock(
			{ injectedJavaScript: 'player();', injectedJavaScriptForMainFrameOnly: true },
			ADBLOCK,
		);

		expect(result.injectedJavaScript).toBe(`player();\n;\n${ADBLOCK}`);
		expect(result.injectedJavaScriptForMainFrameOnly).toBe(true);
	});

	test('treats blank scripts as none', () => {
		const result = withAdblock(
			{ injectedJavaScript: '  ', injectedJavaScriptBeforeContentLoaded: '' },
			ADBLOCK,
		);

		expect(result.injectedJavaScript).toBe(ADBLOCK);
		expect(result.injectedJavaScriptBeforeContentLoaded).toBe(ADBLOCK);
	});
});
