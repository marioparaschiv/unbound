import { describe, expect, test } from 'bun:test';

import { buildAdblockScript, INJECTED_FLAG } from '~/adblock-script';

type FakeElement = {
	localName?: string;
	style: Record<string, string>;
	parentNode?: FakeElement;
	textContent?: string;
	duration?: number;
	currentTime?: number;
	clicked?: boolean;
	click?: () => void;
};

type PageOptions = {
	host: string;
	readyState?: string;
	adShowing?: boolean;
	dynamicAd?: FakeElement;
};

function element(fields: Partial<FakeElement> = {}): FakeElement {
	return { style: {}, ...fields };
}

function createPage({ host, readyState = 'complete', adShowing = false, dynamicAd }: PageOptions) {
	const appended: FakeElement[] = [];
	const listeners: Record<string, () => void> = {};
	const timers: (() => void)[] = [];
	const observed: unknown[] = [];
	const video = element({ duration: 30, currentTime: 0 });
	const skip = element();

	skip.click = () => {
		skip.clicked = true;
	};

	const queries: Record<string, FakeElement | null> = {
		'.ad-showing': adShowing ? element() : null,
		video,
	};

	const document = {
		readyState,
		head: { appendChild: (child: FakeElement) => appended.push(child) },
		documentElement: {},
		createElement: () => element(),
		addEventListener: (name: string, listener: () => void) => {
			listeners[name] = listener;
		},
		querySelector: (selector: string) =>
			selector.includes('skip') ? skip : (queries[selector] ?? null),
		querySelectorAll: () => (dynamicAd ? [dynamicAd] : []),
	};

	class FakeMutationObserver {
		constructor(readonly callback: () => void) {}

		observe(target: unknown) {
			observed.push(target);
		}
	}

	class FakeResponse {
		constructor(readonly body: unknown) {}

		json() {
			return Promise.resolve(this.body);
		}
	}

	const fakeJson = { parse: JSON.parse, stringify: JSON.stringify };
	const window: Record<string, unknown> = {};
	const globals = {
		window,
		document,
		location: { hostname: host },
		JSON: fakeJson,
		Response: FakeResponse,
		MutationObserver: FakeMutationObserver,
		setTimeout: (callback: () => void) => timers.push(callback),
	};

	function run() {
		const names = Object.keys(globals);
		const values = Object.values(globals);

		return new Function(...names, buildAdblockScript())(...values);
	}

	return {
		run,
		window,
		fakeJson,
		FakeResponse,
		appended,
		listeners,
		timers,
		observed,
		video,
		skip,
	};
}

const PLAYER_RESPONSE = JSON.stringify({
	adPlacements: [{ id: 1 }],
	playerAds: [{ id: 2 }],
	adSlots: [{ id: 3 }],
	videoDetails: { videoId: 'x', title: 'adPlacements' },
	nested: { playerResponse: { adPlacements: [{ id: 4 }], streamingData: { formats: [1] } } },
});

describe('buildAdblockScript', () => {
	test('is a self-contained script ending in true', () => {
		const page = createPage({ host: 'example.com' });

		expect(page.run()).toBeUndefined();
		expect(buildAdblockScript().endsWith('true;')).toBe(true);
		expect(buildAdblockScript()).not.toMatch(/__[A-Z_]+__/);
	});

	test('empties ad fields of parsed JSON on YouTube', () => {
		const page = createPage({ host: 'www.youtube.com' });

		page.run();

		const parsed = page.fakeJson.parse(PLAYER_RESPONSE);

		expect(parsed.adPlacements).toEqual([]);
		expect(parsed.playerAds).toEqual([]);
		expect(parsed.adSlots).toEqual([]);
		expect(parsed.nested.playerResponse.adPlacements).toEqual([]);
		expect(parsed.nested.playerResponse.streamingData).toEqual({ formats: [1] });
		expect(parsed.videoDetails).toEqual({ videoId: 'x', title: 'adPlacements' });
		expect(page.fakeJson.parse('"text"')).toBe('text');
		expect(page.fakeJson.parse('null')).toBeNull();
	});

	test('empties ad fields of fetched JSON', async () => {
		const page = createPage({ host: 'www.youtube-nocookie.com' });

		page.run();

		const body = await new page.FakeResponse(JSON.parse(PLAYER_RESPONSE)).json();

		expect((body as { playerAds: unknown }).playerAds).toEqual([]);
	});

	test('does nothing outside YouTube', () => {
		const page = createPage({ host: 'youtube.com.evil.test' });
		const parse = page.fakeJson.parse;

		page.run();

		expect(page.fakeJson.parse).toBe(parse);
		expect(page.window[INJECTED_FLAG]).toBeUndefined();
		expect(page.appended).toHaveLength(0);
	});

	test('runs once per page', () => {
		const page = createPage({ host: 'youtube.com' });

		page.run();

		const parse = page.fakeJson.parse;

		page.run();

		expect(page.fakeJson.parse).toBe(parse);
		expect(page.appended).toHaveLength(1);
		expect(page.window[INJECTED_FLAG]).toBe(true);
	});

	test('hides ad elements and watches the page once it is ready', () => {
		const page = createPage({ host: 'www.youtube.com' });

		page.run();

		const css = String(page.appended[0]?.textContent);

		expect(css).toContain('.ytp-ad-overlay-container');
		expect(css).toContain('[class*="ytd-display-ad-"]');
		expect(css.endsWith('{ display: none !important; }')).toBe(true);
		expect(page.observed).toHaveLength(1);
	});

	test('waits for the DOM when injected before content loads', () => {
		const page = createPage({ host: 'www.youtube.com', readyState: 'loading' });

		page.run();

		expect(page.appended).toHaveLength(0);
		expect(page.fakeJson.parse(PLAYER_RESPONSE).adPlacements).toEqual([]);

		page.listeners.DOMContentLoaded?.();

		expect(page.appended).toHaveLength(1);
	});

	test('skips a video ad that still plays', () => {
		const page = createPage({ host: 'www.youtube.com', adShowing: true });

		page.run();

		expect(page.video.currentTime).toBe(30);

		for (const timer of page.timers) timer();

		expect(page.skip.clicked).toBe(true);
	});

	test('leaves the video alone without an ad', () => {
		const page = createPage({ host: 'www.youtube.com' });

		page.run();

		expect(page.video.currentTime).toBe(0);
		expect(page.timers).toHaveLength(0);
	});

	test('hides promoted rows in feeds', () => {
		const row = element({ localName: 'ytd-rich-item-renderer' });
		const ad = element({ parentNode: element({ parentNode: row }) });
		const page = createPage({ host: 'www.youtube.com', dynamicAd: ad });

		page.run();

		expect(row.style.display).toBe('none');
	});
});
