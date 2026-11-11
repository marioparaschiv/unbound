import { describe, expect, test } from 'bun:test';

import { embedUrl, pauseScript, playerHtml, staysInPlayer, toVideoId } from '~/lib/player';

const ID = 'dQw4w9WgXcQ';

describe('toVideoId', () => {
	test('accepts a bare video id', () => {
		expect(toVideoId(ID)).toBe(ID);
		expect(toVideoId(` ${ID} `)).toBe(ID);
		expect(toVideoId('a-b_c-d_e-f')).toBe('a-b_c-d_e-f');
	});

	test('reads the id from YouTube links', () => {
		expect(toVideoId(`https://www.youtube-nocookie.com/watch?v=${ID}&t=42s`)).toBe(ID);
		expect(toVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
		expect(toVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
		expect(toVideoId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
		expect(toVideoId(`https://www.youtube.com/embed/${ID}?autoplay=1`)).toBe(ID);
		expect(toVideoId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID);
		expect(toVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
		expect(toVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
		expect(toVideoId(`https://WWW.YOUTUBE.COM/watch?v=${ID}`)).toBe(ID);
	});

	test('rejects values that name no YouTube video', () => {
		expect(toVideoId(undefined)).toBeUndefined();
		expect(toVideoId(null)).toBeUndefined();
		expect(toVideoId(42)).toBeUndefined();
		expect(toVideoId('')).toBeUndefined();
		expect(toVideoId('short')).toBeUndefined();
		expect(toVideoId('dQw4w9WgXcQ1')).toBeUndefined();
		expect(toVideoId('dQw4w9WgX"Q')).toBeUndefined();
		expect(toVideoId(`https://example.com/watch?v=${ID}`)).toBeUndefined();
		expect(toVideoId(`https://youtube.com.evil.test/watch?v=${ID}`)).toBeUndefined();
		expect(toVideoId('https://www.youtube-nocookie.com/watch')).toBeUndefined();
		expect(toVideoId('https://www.youtube-nocookie.com/watch?v=<script>')).toBeUndefined();
		expect(toVideoId('https://www.youtube.com/channel/UCabcdefghij')).toBeUndefined();
	});
});

describe('embedUrl', () => {
	test('builds an inline youtube-nocookie.com embed', () => {
		const url = new URL(embedUrl(ID));

		expect(url.origin).toBe('https://www.youtube-nocookie.com');
		expect(url.pathname).toBe(`/embed/${ID}`);
		expect(url.searchParams.get('playsinline')).toBe('1');
		expect(url.searchParams.get('rel')).toBe('0');
		expect(url.searchParams.has('autoplay')).toBe(false);
	});

	test('accepts iframe API commands from the youtube-nocookie.com player page', () => {
		const url = new URL(embedUrl(ID));

		expect(url.searchParams.get('enablejsapi')).toBe('1');
		expect(url.searchParams.get('origin')).toBe('https://www.youtube-nocookie.com');
	});
});

describe('pauseScript', () => {
	function runPause(frame: unknown): unknown {
		const document = {
			querySelector: (selector: string) => (selector === 'iframe' ? frame : null),
		};

		return new Function('document', pauseScript())(document);
	}

	test('posts a pauseVideo command to the embed frame on youtube-nocookie.com', () => {
		const posted: [unknown, unknown][] = [];
		const frame = {
			contentWindow: {
				postMessage: (data: unknown, origin: unknown) => posted.push([data, origin]),
			},
		};

		runPause(frame);

		expect(posted).toHaveLength(1);
		expect(JSON.parse(posted[0]?.[0] as string)).toEqual({
			event: 'command',
			func: 'pauseVideo',
			args: [],
		});
		expect(posted[0]?.[1]).toBe('https://www.youtube-nocookie.com');
	});

	test('does nothing when the frame is missing', () => {
		expect(() => runPause(null)).not.toThrow();
	});

	test('ends in true as injectJavaScript expects', () => {
		expect(pauseScript().endsWith('true;')).toBe(true);
	});
});

describe('playerHtml', () => {
	test('frames the embed to fill the page', () => {
		const html = playerHtml(ID);

		expect(html.startsWith('<!doctype html>')).toBe(true);
		expect(html).toContain(`<iframe src="${embedUrl(ID)}"`);
		expect(html).toContain('allowfullscreen');
		expect(html).toContain('encrypted-media');
	});

	test('has exactly one frame and no script', () => {
		const html = playerHtml(ID);

		expect(html.match(/<iframe/g)).toHaveLength(1);
		expect(html).not.toContain('<script');
	});
});

describe('staysInPlayer', () => {
	test('keeps the player page itself', () => {
		expect(staysInPlayer('https://www.youtube-nocookie.com/', true)).toBe(true);
		expect(staysInPlayer('https://www.youtube-nocookie.com', true)).toBe(true);
		expect(staysInPlayer('about:blank', true)).toBe(true);
		expect(staysInPlayer('data:text/html,', undefined)).toBe(true);
	});

	test('keeps everything that loads inside the frame', () => {
		expect(staysInPlayer(embedUrl(ID), false)).toBe(true);
		expect(staysInPlayer('https://accounts.google.com/x', false)).toBe(true);
	});

	test('sends links that would replace the page outside Discord', () => {
		expect(staysInPlayer(`https://www.youtube-nocookie.com/watch?v=${ID}`, true)).toBe(false);
		expect(staysInPlayer(`https://www.youtube-nocookie.com/watch?v=${ID}`, undefined)).toBe(
			false,
		);
		expect(staysInPlayer('https://www.youtube-nocookie.com/@channel', true)).toBe(false);
		expect(staysInPlayer('https://example.com/', true)).toBe(false);
		expect(staysInPlayer('not a url', true)).toBe(false);
	});
});
