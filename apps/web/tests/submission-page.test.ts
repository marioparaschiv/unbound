import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, describe, expect, spyOn, test } from 'bun:test';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import { MEDIA_READ_CONCURRENCY } from '~/lib/addon-page-source';
import type { AppContext } from '~/lib/context';
import type { EnvSource } from '~/lib/env';

import {
	COMMITTED_ADDON_MD,
	committedPage,
	committedPageFiles,
	manyMediaFiles,
	png,
} from './helpers/addon-page';
import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { commitPlugin, serveGitHub, type FixtureFiles } from './helpers/github';
import { withMemoryStaging } from './helpers/storage';

const REPOSITORY = 'acme/addons';
const ACCOUNT_CREATED = new Date('2020-01-01T00:00:00.000Z');

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);

async function setup(overrides: EnvSource = {}) {
	const test = await createTestContext({
		GITHUB_API_URL: github.url.href,
		GITHUB_RATE_LIMIT_MAX: '1000',
		...overrides,
	});
	const { ctx, staging } = withMemoryStaging(test.ctx);

	return { ctx, staging, close: test.close };
}

const main = await setup();
const { ctx, staging } = main;

afterAll(async () => {
	await main.close();
	await github.stop();
});

let users = 0;

async function signUp(target: AppContext = ctx) {
	users += 1;

	const signedIn = await signInWithDiscord(target, {
		id: snowflakeAt(ACCOUNT_CREATED),
		name: `User ${users}`,
		email: `user-${users}@example.com`,
	});

	await linkGitHub(target, signedIn.userId, 'owner');

	return signedIn;
}

function submit(headers: Headers, request: CreateSubmissionRequest, target: AppContext = ctx) {
	return createSubmissionEndpoint.handle(
		target,
		new Request(new URL('/api/v1/submissions', target.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify(request),
		}),
	);
}

async function accepted(response: Response) {
	expect(response.status).toBe(200);

	return createSubmissionResponseSchema.parse(await response.json());
}

async function refused(response: Response) {
	const { error } = apiErrorResponseSchema.parse(await response.json());

	return { status: response.status, code: error.code };
}

function commitPage(id: string, files: FixtureFiles = {}) {
	return commitPlugin(fixture, REPOSITORY, id, '1.0.0', {
		...committedPageFiles(),
		...files,
	});
}

describe('the store page', () => {
	test('stores the measured page beside ADDON.md', async () => {
		const { headers } = await signUp();
		const { submission: created } = await accepted(
			await submit(headers, commitPage('page.valid').request),
		);
		const row = await ctx.db.query.submission.findFirst({
			where: { id: created.id },
			with: { source: true },
		});

		expect(row?.source?.addonMd).toBe(COMMITTED_ADDON_MD);
		expect(row?.source?.page).toEqual(committedPage(64));
	});

	test('stores no page when none is committed', async () => {
		const { headers } = await signUp();
		const { request } = commitPage('page.unbuilt', { 'dist/page.json': null });
		const { submission: created } = await accepted(await submit(headers, request));
		const row = await ctx.db.query.submission.findFirst({
			where: { id: created.id },
			with: { source: true },
		});

		expect(row?.source).toMatchObject({ addonMd: COMMITTED_ADDON_MD, page: null });
	});

	test('refuses a page whose media file is not committed, staging nothing', async () => {
		const { headers } = await signUp();
		const { request } = commitPage('page.missing', { 'media/shot.png': null });
		const staged = staging.objects.size;

		expect(await refused(await submit(headers, request))).toEqual({
			status: 422,
			code: 'artifact_missing',
		});
		expect(staging.objects.size).toBe(staged);
	});

	test('refuses media over ADDON_MEDIA_MAX_BYTES or ADDON_MEDIA_TOTAL_MAX_BYTES', async () => {
		const limited = await setup({
			ADDON_MEDIA_MAX_BYTES: '100',
			ADDON_MEDIA_TOTAL_MAX_BYTES: '250',
		});

		try {
			const { headers } = await signUp(limited.ctx);
			const oversize = commitPlugin(
				fixture,
				REPOSITORY,
				'page.oversize',
				'1.0.0',
				committedPageFiles(101),
			);
			const total = commitPlugin(
				fixture,
				REPOSITORY,
				'page.total',
				'1.0.0',
				committedPageFiles(100),
			);
			const refusals = await Promise.all([
				submit(headers, oversize.request, limited.ctx).then(refused),
				submit(headers, total.request, limited.ctx).then(refused),
			]);

			expect(refusals).toEqual([
				{ status: 413, code: 'artifact_too_large' },
				{ status: 413, code: 'artifact_too_large' },
			]);

			await accepted(await submit(headers, commitPage('page.small').request, limited.ctx));
		} finally {
			await limited.close();
		}
	});

	test('refuses media that differ from what ubd build measured', async () => {
		const { headers } = await signUp();
		const jpeg = new Uint8Array(64);

		jpeg.set([0xff, 0xd8, 0xff]);

		const requests = [
			commitPage('page.resized', { 'media/shot.png': new Uint8Array(65) }),
			commitPage('page.renamed', { 'media/shot.png': jpeg }),
			commitPage('page.stale', {
				'ADDON.md': COMMITTED_ADDON_MD.replace('The settings', 'Another'),
			}),
			commitPage('page.unmarked', { 'ADDON.md': '## Usage' }),
		].map(({ request }) => request);
		const refusals = await Promise.all(
			requests.map((request) => submit(headers, request).then(refused)),
		);

		expect(refusals.map((entry) => entry.code)).toEqual([
			'artifact_mismatch',
			'artifact_mismatch',
			'artifact_mismatch',
			'artifact_mismatch',
		]);
	});

	test('refuses a page that measures media ADDON.md does not show, or misses one it does', async () => {
		const { headers } = await signUp();
		const page = committedPage(64);
		const [banner] = page.media;
		const extra = {
			...page,
			media: [...page.media, { ...banner, path: 'media/extra.png' }],
		};
		const requests = [
			commitPage('page.extra', {
				'dist/page.json': JSON.stringify(extra),
				'media/extra.png': png(64),
			}),
			commitPage('page.unmeasured', {
				'ADDON.md': `${COMMITTED_ADDON_MD}\n![Another](media/another.png)\n`,
				'media/another.png': png(64),
			}),
		].map(({ request }) => request);
		const refusals = await Promise.all(
			requests.map((request) => submit(headers, request).then(refused)),
		);

		expect(refusals).toEqual([
			{ status: 409, code: 'artifact_mismatch' },
			{ status: 409, code: 'artifact_mismatch' },
		]);
	});

	test(`reads at most ${MEDIA_READ_CONCURRENCY} media files from GitHub at once`, async () => {
		const { headers } = await signUp();
		const { request } = commitPlugin(
			fixture,
			REPOSITORY,
			'page.many',
			'1.0.0',
			manyMediaFiles(15),
		);
		const original = globalThis.fetch;
		let inFlight = 0;
		let peak = 0;
		let reads = 0;

		async function countBlobReads(input: RequestInfo | URL, init?: RequestInit) {
			const url = input instanceof Request ? input.url : String(input);

			if (!url.includes('/git/blobs/')) {
				return original(input, init);
			}

			reads += 1;
			inFlight += 1;
			peak = Math.max(peak, inFlight);

			try {
				await Bun.sleep(5);

				return await original(input, init);
			} finally {
				inFlight -= 1;
			}
		}

		const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
			Object.assign(countBlobReads, { preconnect: original.preconnect }),
		);

		try {
			await accepted(await submit(headers, request));
		} finally {
			fetchSpy.mockRestore();
		}

		expect(reads).toBeGreaterThan(16);
		expect(peak).toBe(MEDIA_READ_CONCURRENCY);
	});
});
