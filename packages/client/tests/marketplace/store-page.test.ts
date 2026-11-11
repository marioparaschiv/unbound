import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { afterAll, describe, expect, test } from 'bun:test';

import {
	fetchStorePage,
	findPageMedia,
	loadStorePage,
	normalizePageBody,
} from '~/marketplace/store-page';

let files: Record<string, string> = {};
let status = 200;
let requests = 0;

const cdn = Bun.serve({
	port: 0,
	fetch(request) {
		const body = files[new URL(request.url).pathname];

		requests += 1;

		if (status !== 200 || body === undefined) {
			return new Response(null, { status: status === 200 ? 404 : status });
		}

		return new Response(body);
	},
});

afterAll(() => cdn.stop(true));

const FOLDER = `${cdn.url.origin}/addons/acme.hello/1.0.0/`;
const PAGE_URL = `${FOLDER}ADDON.md`;
const THUMBHASH = 'IhUKMphwd3eIiHiIgHcIh4g=';

const MEASURED: AddonPage = {
	frontmatter: {
		banner: 'media/banner.png',
		media: [{ image: 'media/shot.png', alt: 'The settings screen' }],
	},
	media: [
		{
			path: 'media/banner.png',
			kind: 'image',
			width: 1500,
			height: 500,
			thumbhash: THUMBHASH,
			bytes: 64,
		},
		{
			path: 'media/shot.png',
			kind: 'image',
			width: 1280,
			height: 720,
			thumbhash: THUMBHASH,
			bytes: 64,
		},
	],
};

const ADDON_MD = ['---', 'banner: media/banner.png', '---', '## Usage', '', 'Open settings.'].join(
	'\n',
);

function serve(served: Record<string, string>, answer: number = 200) {
	files = Object.fromEntries(
		Object.entries(served).map(([url, body]) => [new URL(url).pathname, body]),
	);
	status = answer;
}

describe('fetchStorePage', () => {
	test('reads ADDON.md without its frontmatter and the measured page beside it', async () => {
		serve({ [PAGE_URL]: ADDON_MD, [`${FOLDER}page.json`]: JSON.stringify(MEASURED) });

		expect(await fetchStorePage(PAGE_URL)).toEqual({
			body: '## Usage\n\nOpen settings.',
			measured: MEASURED,
			icons: new Map(),
			folder: FOLDER,
		});
	});

	test('reads the whole page from store-page.json in one request', async () => {
		const gear = '<svg viewBox="0 0 20 20"><circle r="2"/></svg>';

		serve({
			[`${FOLDER}store-page.json`]: JSON.stringify({
				body: ':gear: Settings',
				measured: MEASURED,
				icons: { gear },
			}),
		});
		requests = 0;

		expect(await fetchStorePage(PAGE_URL)).toEqual({
			body: ':gear: Settings',
			measured: MEASURED,
			icons: new Map([['gear', gear]]),
			folder: FOLDER,
		});
		expect(requests).toBe(1);
	});

	test('a version without page.json has a body and no media', async () => {
		serve({ [PAGE_URL]: 'Just text.' });

		expect(await fetchStorePage(PAGE_URL)).toEqual({
			body: 'Just text.',
			measured: null,
			icons: new Map(),
			folder: FOLDER,
		});
	});

	test('a page.json that is not whole JSON counts as none', async () => {
		serve({ [PAGE_URL]: 'Just text.', [`${FOLDER}page.json`]: '{"media": ' });

		expect((await fetchStorePage(PAGE_URL))?.measured).toBeNull();
	});

	test('ADDON.md missing from the CDN means no page', async () => {
		serve({});

		expect(await fetchStorePage(PAGE_URL)).toBeNull();
	});

	test('a CDN error throws, so the screen can offer a retry', async () => {
		serve({ [PAGE_URL]: ADDON_MD }, 503);

		const failure = await fetchStorePage(PAGE_URL).then(
			() => '',
			(error: Error) => error.message,
		);

		expect(failure).toContain('503');
	});
});

describe('findPageMedia', () => {
	const page = { body: '', measured: MEASURED, icons: new Map<string, string>(), folder: FOLDER };

	test('resolves a measured path against the version folder', () => {
		expect(findPageMedia(page, 'media/shot.png')).toEqual({
			...MEASURED.media[1],
			url: `${FOLDER}media/shot.png`,
		});
	});

	test('refuses a path the page did not measure', () => {
		expect(findPageMedia(page, 'media/other.png')).toBeUndefined();
		expect(findPageMedia({ ...page, measured: null }, 'media/shot.png')).toBeUndefined();
	});
});

describe('loadStorePage', () => {
	test('fetches a version once and serves later visits from memory', async () => {
		const url = `${FOLDER}cached/ADDON.md`;

		serve({ [url]: 'Cached.' });
		requests = 0;

		const [first, second] = await Promise.all([loadStorePage(url), loadStorePage(url)]);

		expect(await loadStorePage(url)).toBe(first);
		expect(second).toBe(first);
		expect(requests).toBe(3);
	});

	test('a failed fetch is forgotten, so a retry asks the CDN again', async () => {
		const url = `${FOLDER}retry/ADDON.md`;

		serve({ [url]: 'Back.' }, 503);

		const failed = await loadStorePage(url).then(
			() => false,
			() => true,
		);

		serve({ [url]: 'Back.' });

		expect(failed).toBe(true);
		expect((await loadStorePage(url))?.body).toBe('Back.');
	});
});

describe('normalizePageBody', () => {
	test('separates headings, fences and lists from the paragraph above them', () => {
		const body = [
			'Intro.',
			'## Usage',
			'Open settings:',
			'- one',
			'- two',
			'```',
			'code',
			'```',
			'Done.',
		];

		expect(normalizePageBody(body.join('\n'))).toBe(
			[
				'Intro.',
				'',
				'## Usage',
				'',
				'Open settings:',
				'',
				'- one',
				'- two',
				'',
				'```',
				'code',
				'```',
				'',
				'Done.',
				'',
				'',
			].join('\n'),
		);
	});

	test('keeps lines inside a code fence as written', () => {
		const body = ['```md', '# Title', 'text', '- item', '```'].join('\n');

		expect(normalizePageBody(body)).toBe(`${body}\n\n\n`);
	});

	test('leaves nested list items and their continuations alone', () => {
		const body = ['- one', '  continued', '  - nested', '- two'].join('\n');

		expect(normalizePageBody(body)).toBe(`${body}\n\n`);
	});
});
