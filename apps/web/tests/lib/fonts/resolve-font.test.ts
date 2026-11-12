import type { ResolvedFont } from '@unbound-app/contracts/fonts';
import { describe, expect, test } from 'bun:test';

import type { FontFetch } from '~/lib/fonts/font-source';
import { resolveFont } from '~/lib/fonts/resolve-font';
import { ApiError } from '~/lib/api/errors';

// Recorded from each provider, trimmed to the parts the resolver reads.
const GOOGLE_LOBSTER = `@font-face {
  font-family: 'Lobster';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/lobster/v32/neILzCirqoswsqX9zoKmNg.ttf) format('truetype');
}`;

const FONTSHARE_SATOSHI = `/* Satoshi */
@font-face {
  font-family: 'Satoshi';
  src: url('//cdn.fontshare.com/wf/A/B/C300.woff2') format('woff2'),
       url('//cdn.fontshare.com/wf/A/B/C300.woff') format('woff'),
       url('//cdn.fontshare.com/wf/A/B/C300.ttf') format('truetype');
  font-weight: 300;
  font-display: swap;
  font-style: normal;
}
@font-face {
  font-family: 'Satoshi';
  src: url('//cdn.fontshare.com/wf/A/B/C300I.woff2') format('woff2'),
       url('//cdn.fontshare.com/wf/A/B/C300I.ttf') format('truetype');
  font-weight: 300;
  font-display: swap;
  font-style: italic;
}
@font-face {
  font-family: 'Satoshi';
  src: url('//cdn.fontshare.com/wf/A/B/VARIABLE.ttf') format('truetype');
  font-weight: 300 900;
  font-display: swap;
  font-style: normal;
}`;

const FONTSOURCE_INTER = {
	family: 'Inter',
	defSubset: 'latin',
	variants: {
		'400': {
			normal: {
				latin: {
					url: {
						woff2: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.woff2',
						ttf: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.ttf',
					},
				},
				greek: {
					url: {
						ttf: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/greek-400-normal.ttf',
					},
				},
			},
		},
	},
};

type Recorded = Record<string, () => Response>;

type RecordingFetch = FontFetch & { requests: string[] };

type Failure = { code: string; status: number };

function recorded(responses: Recorded): RecordingFetch {
	const requests: string[] = [];

	async function fetch(url: string): Promise<Response> {
		requests.push(url);

		return responses[url]?.() ?? new Response('Not Found', { status: 404 });
	}

	return Object.assign(fetch, { requests });
}

async function offline(): Promise<Response> {
	throw new TypeError('fetch failed');
}

const GOOGLE_URL = (family: string) =>
	`https://fonts.googleapis.com/css?family=${family}:100,100i,200,200i,300,300i,400,400i,500,500i,600,600i,700,700i,800,800i,900,900i`;

async function failure(promise: Promise<unknown>): Promise<Failure> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ApiError) {
			return { code: error.code, status: error.status };
		}

		throw error;
	}

	throw new Error('Expected the promise to reject.');
}

describe('resolveFont', () => {
	test('resolves a Google family name, specimen link and stylesheet link to the same faces', async () => {
		const fetch = recorded({ [GOOGLE_URL('Lobster')]: () => new Response(GOOGLE_LOBSTER) });
		const expected: ResolvedFont = {
			provider: 'google',
			id: 'Lobster',
			family: 'Lobster',
			files: [
				{
					url: 'https://fonts.gstatic.com/s/lobster/v32/neILzCirqoswsqX9zoKmNg.ttf',
					kind: 'font',
					weight: 400,
					style: 'normal',
				},
			],
		};

		expect(await resolveFont('Lobster', fetch)).toEqual(expected);
		expect(await resolveFont('https://fonts.google.com/specimen/Lobster', fetch)).toEqual(
			expected,
		);
		expect(await resolveFont('fonts.google.com/specimen/Lobster?query=x', fetch)).toEqual(
			expected,
		);
		expect(
			await resolveFont(
				'https://fonts.googleapis.com/css2?family=Lobster:wght@400&display=swap',
				fetch,
			),
		).toEqual(expected);
	});

	test('asks Google for multi-word families with plus signs', async () => {
		const fetch = recorded({
			[GOOGLE_URL('Noto+Sans+JP')]: () =>
				new Response(GOOGLE_LOBSTER.replace('Lobster', 'Noto Sans JP')),
		});

		const font = await resolveFont('https://fonts.google.com/specimen/Noto+Sans+JP', fetch);

		expect(font).toMatchObject({ id: 'Noto Sans JP', family: 'Noto Sans JP' });
	});

	test('finds a family typed in the wrong case through its Fontsource spelling', async () => {
		const fetch = recorded({
			[GOOGLE_URL('jetbrains+mono')]: () => new Response('', { status: 400 }),
			'https://api.fontsource.org/v1/fonts/jetbrains-mono': () =>
				Response.json({ ...FONTSOURCE_INTER, family: 'JetBrains Mono' }),
			[GOOGLE_URL('JetBrains+Mono')]: () =>
				new Response(GOOGLE_LOBSTER.replace('Lobster', 'JetBrains Mono')),
		});

		expect(await resolveFont('jetbrains mono', fetch)).toMatchObject({
			provider: 'google',
			id: 'JetBrains Mono',
			family: 'JetBrains Mono',
		});
	});

	test('asks Fontsource nothing when Google knows the name as typed', async () => {
		const fetch = recorded({ [GOOGLE_URL('Lobster')]: () => new Response(GOOGLE_LOBSTER) });

		await resolveFont('Lobster', fetch);

		expect(fetch.requests).toEqual([GOOGLE_URL('Lobster')]);
	});

	test('reports a family Google does not have as not_found', async () => {
		const fetch = recorded({ [GOOGLE_URL('Nope')]: () => new Response('', { status: 400 }) });

		expect(await failure(resolveFont('Nope', fetch))).toEqual({
			code: 'not_found',
			status: 404,
		});
	});

	test("reads Fontshare's static ttf faces and skips its variable one", async () => {
		const fetch = recorded({
			'https://api.fontshare.com/v2/css?f[]=satoshi@all': () =>
				new Response(FONTSHARE_SATOSHI),
		});

		expect(await resolveFont('https://www.fontshare.com/fonts/satoshi', fetch)).toEqual({
			provider: 'fontshare',
			id: 'satoshi',
			family: 'Satoshi',
			files: [
				{
					url: 'https://cdn.fontshare.com/wf/A/B/C300.ttf',
					kind: 'font',
					weight: 300,
					style: 'normal',
				},
				{
					url: 'https://cdn.fontshare.com/wf/A/B/C300I.ttf',
					kind: 'font',
					weight: 300,
					style: 'italic',
				},
			],
		});
	});

	test('keeps a variable or web-font-only face, with a null weight for the variable one', async () => {
		const css = `@font-face {
  font-family: 'Inter';
  src: url('//cdn.fontshare.com/wf/V/A/R.woff2') format('woff2'),
       url('//cdn.fontshare.com/wf/V/A/R.woff') format('woff');
  font-weight: 100 900;
  font-style: normal;
}
@font-face {
  font-family: 'Inter';
  src: url('//cdn.fontshare.com/wf/S/T/A.woff') format('woff');
  font-weight: 400;
  font-style: italic;
}`;
		const fetch = recorded({
			'https://api.fontshare.com/v2/css?f[]=inter@all': () => new Response(css),
		});

		expect(await resolveFont('https://www.fontshare.com/fonts/inter', fetch)).toMatchObject({
			files: [
				{
					url: 'https://cdn.fontshare.com/wf/S/T/A.woff',
					kind: 'font',
					weight: 400,
					style: 'italic',
				},
				{
					url: 'https://cdn.fontshare.com/wf/V/A/R.woff2',
					kind: 'font',
					weight: null,
					style: 'normal',
				},
			],
		});
	});

	test('treats an empty Fontshare stylesheet as not_found', async () => {
		const fetch = recorded({
			'https://api.fontshare.com/v2/css?f[]=nope@all': () => new Response('/* nothing */'),
		});

		expect(await failure(resolveFont('https://fontshare.com/fonts/nope', fetch))).toEqual({
			code: 'not_found',
			status: 404,
		});
	});

	test("resolves Fontsource and Bunny Fonts links to Fontsource's default-subset ttf files", async () => {
		const fetch = recorded({
			'https://api.fontsource.org/v1/fonts/inter': () => Response.json(FONTSOURCE_INTER),
		});
		const expected: ResolvedFont = {
			provider: 'fontsource',
			id: 'inter',
			family: 'Inter',
			files: [
				{
					url: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.ttf',
					kind: 'font',
					weight: 400,
					style: 'normal',
				},
			],
		};

		expect(await resolveFont('https://fontsource.org/fonts/inter', fetch)).toEqual(expected);
		expect(await resolveFont('https://fonts.bunny.net/family/inter', fetch)).toEqual(expected);
		expect(
			await resolveFont('https://fonts.bunny.net/css?family=inter:400,700', fetch),
		).toEqual(expected);
	});

	test('rewrites links that need no request: Font Squirrel, dafont, GitHub and direct files', async () => {
		const fetch = recorded({});

		expect(await resolveFont('https://www.fontsquirrel.com/fonts/open-sans', fetch)).toEqual({
			provider: 'fontsquirrel',
			id: 'open-sans',
			family: 'Open Sans',
			files: [
				{
					url: 'https://www.fontsquirrel.com/fonts/download/open-sans',
					kind: 'archive',
					weight: null,
					style: null,
				},
			],
		});
		expect(
			await resolveFont('https://www.fontsquirrel.com/fonts/download/open-sans', fetch),
		).toMatchObject({ id: 'open-sans' });
		expect(await resolveFont('https://www.dafont.com/bebas-neue.font', fetch)).toEqual({
			provider: 'dafont',
			id: 'bebas-neue',
			family: 'Bebas Neue',
			files: [
				{
					url: 'https://dl.dafont.com/dl/?f=bebas_neue',
					kind: 'archive',
					weight: null,
					style: null,
				},
			],
		});
		expect(
			await resolveFont(
				'https://github.com/rsms/inter/blob/master/docs/font-files/Inter-Bold.otf',
				fetch,
			),
		).toEqual({
			provider: 'github',
			id: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Bold.otf',
			family: 'Inter-Bold',
			files: [
				{
					url: 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Bold.otf',
					kind: 'font',
					weight: null,
					style: null,
				},
			],
		});
		expect(
			await resolveFont(
				'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
				fetch,
			),
		).toMatchObject({ provider: 'github', files: [{ kind: 'archive' }] });
		expect(await resolveFont('https://example.com/fonts/My%20Font.ttf', fetch)).toMatchObject({
			provider: 'url',
			family: 'My Font',
			files: [{ url: 'https://example.com/fonts/My%20Font.ttf', kind: 'font' }],
		});
		expect(await resolveFont('https://example.com/fonts/Inter.woff2', fetch)).toMatchObject({
			provider: 'url',
			family: 'Inter',
			files: [{ url: 'https://example.com/fonts/Inter.woff2', kind: 'font' }],
		});
		expect(fetch.requests).toEqual([]);
	});

	test('rejects input that is neither a family name nor a font link, without fetching', async () => {
		const fetch = recorded({});

		for (const input of [
			'https://example.com/page.html',
			'http://example.com/font.ttf',
			'file:///etc/passwd',
			'javascript:alert(1)',
			'../../etc',
			'Inter; DROP',
		]) {
			expect(await failure(resolveFont(input, fetch))).toEqual({
				code: 'invalid_request',
				status: 400,
			});
		}

		expect(fetch.requests).toEqual([]);
	});

	test('reports provider outages and network errors as font_source_unavailable', async () => {
		const down = recorded({ [GOOGLE_URL('Inter')]: () => new Response('', { status: 503 }) });

		expect(await failure(resolveFont('Inter', down))).toEqual({
			code: 'font_source_unavailable',
			status: 502,
		});
		expect(await failure(resolveFont('Inter', offline))).toEqual({
			code: 'font_source_unavailable',
			status: 502,
		});
	});
});
