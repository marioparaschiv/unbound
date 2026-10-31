import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { afterAll, describe, expect, test } from 'bun:test';

import { fetchStorePage, findPageMedia, splitPageBody } from './store-page';

let files: Record<string, string> = {};
let status = 200;

const cdn = Bun.serve({
	port: 0,
	fetch(request) {
		const body = files[new URL(request.url).pathname];

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
			folder: FOLDER,
		});
	});

	test('a version without page.json has a body and no media', async () => {
		serve({ [PAGE_URL]: 'Just text.' });

		expect(await fetchStorePage(PAGE_URL)).toEqual({
			body: 'Just text.',
			measured: null,
			folder: FOLDER,
		});
	});

	test('a page.json that is not a valid page counts as none', async () => {
		serve({ [PAGE_URL]: 'Just text.', [`${FOLDER}page.json`]: '{"media": 1}' });

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
	const page = { body: '', measured: MEASURED, folder: FOLDER };

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

describe('splitPageBody', () => {
	test('lays out lines that hold only media as blocks between runs of text', () => {
		const body = [
			'Intro.',
			'',
			'![Shot](media/shot.png)',
			'',
			'An ![inline](media/a.png) image.',
		].join('\n');

		expect(splitPageBody(body)).toEqual([
			{ kind: 'markdown', source: 'Intro.\n' },
			{ kind: 'media', alt: 'Shot', path: 'media/shot.png' },
			{ kind: 'markdown', source: '\nAn ![inline](media/a.png) image.' },
		]);
	});

	test('keeps media lines inside a code fence as text', () => {
		const body = ['```md', '![Shot](media/shot.png)', '```'].join('\n');

		expect(splitPageBody(body)).toEqual([{ kind: 'markdown', source: body }]);
	});

	test('a body without media is one run of text', () => {
		expect(splitPageBody('## Usage\n\nOpen settings.')).toEqual([
			{ kind: 'markdown', source: '## Usage\n\nOpen settings.' },
		]);
	});
});
