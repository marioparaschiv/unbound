import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import { reviewSubmissionResponseSchema } from '@unbound-app/contracts/review';
import type { ReviewSubmissionRequest } from '@unbound-app/contracts/review';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import reviewSubmissionEndpoint from '~/endpoints/review-submission';
import getCatalogEndpoint from '~/endpoints/get-catalog';
import { createApiClient } from '~/api/client';
import { submission, user } from '~/db/schema';
import type { Role } from '~/lib/auth/access';
import type { Api } from '~/api';

import { COMMITTED_ADDON_MD, committedPage, committedPageFiles, png } from './helpers/addon-page';
import { S3_TEST_ENV, createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { failure, serveEndpoints } from './helpers/server';

const REPOSITORY = 'acme/addons';
const PREFIX = 'addons/review-media.';
const MEDIA = ['media/banner.png', 'media/shot.png', 'media/inline.png'];

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);

// The real clock: MinIO checks presigned URLs against it.
const { ctx, close } = await createTestContext({
	...S3_TEST_ENV,
	GITHUB_API_URL: github.url.href,
	CDN_URL: `${S3_TEST_ENV.S3_ENDPOINT}/${S3_TEST_ENV.S3_PUBLIC_BUCKET}/`,
});

const server = serveEndpoints(ctx, {
	'POST /api/v1/submissions': createSubmissionEndpoint,
	'POST /api/v1/submissions/$id/review': reviewSubmissionEndpoint,
	'GET /api/v1/catalog': getCatalogEndpoint,
});

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);
	const published = await ctx.storage.public.list({ prefix: PREFIX });

	await Promise.all([
		...rows.map((row) => ctx.storage.staging.delete(row.key)),
		...(published.contents ?? []).map((object) => ctx.storage.public.delete(object.key)),
	]);
	await server.stop(true);
	await github.stop();
	await close();
});

let users = 0;

async function signUp(role: Role = 'user') {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Member ${users}`,
		email: `media-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));
	await linkGitHub(ctx, userId, 'owner');

	return createApiClient<Api>({ baseUrl: server.url.href, headers });
}

type Client = Awaited<ReturnType<typeof signUp>>;

async function submitPage(author: Client, id: string) {
	const { request } = commitPlugin(fixture, REPOSITORY, id, '1.0.0', committedPageFiles());
	const created = await author('POST /api/v1/submissions', {
		body: request,
		response: createSubmissionResponseSchema,
	});

	return created.submission.id;
}

function review(reviewer: Client, id: string, request: ReviewSubmissionRequest) {
	return reviewer('POST /api/v1/submissions/$id/review', {
		params: { id },
		body: request,
		response: reviewSubmissionResponseSchema,
	});
}

async function listPublic(id: string) {
	const listed = await ctx.storage.public.list({ prefix: `addons/${id}/` });

	return (listed.contents ?? []).map((object) => object.key).toSorted();
}

async function findStatus(id: string) {
	const [row] = await ctx.db
		.select({ status: submission.status })
		.from(submission)
		.where(eq(submission.id, id));

	return row?.status;
}

describe('publishing the store page', () => {
	test('approval copies ADDON.md, page.json and every media file under the version folder', async () => {
		const [author, moderator] = await Promise.all([signUp(), signUp('moderator')]);
		const id = await submitPage(author, 'review-media.approved');

		await review(moderator, id, { decision: 'approved' });

		const base = 'addons/review-media.approved/1.0.0';
		const names = ['ADDON.md', 'index.js', 'manifest.json', 'page.json', ...MEDIA];

		expect(await listPublic('review-media.approved')).toEqual(
			names.map((name) => `${base}/${name}`).toSorted(),
		);
		expect(await ctx.storage.public.file(`${base}/ADDON.md`).text()).toBe(COMMITTED_ADDON_MD);
		expect(await ctx.storage.public.file(`${base}/page.json`).json()).toEqual(
			committedPage(64),
		);

		for (const path of MEDIA) {
			expect(await ctx.storage.public.file(`${base}/${path}`).bytes()).toEqual(
				new Uint8Array(png(64)),
			);
		}
	});

	test('the catalog’s page URL loads the page, and its media resolve beside it', async () => {
		const [author, moderator] = await Promise.all([signUp(), signUp('moderator')]);
		const id = await submitPage(author, 'review-media.catalogued');

		await review(moderator, id, { decision: 'approved' });

		const catalog = await author('GET /api/v1/catalog', { response: catalogResponseSchema });
		const entry = catalog.addons.find((addon) => addon.id === 'review-media.catalogued');
		const pageUrl = entry?.latestVersion.pageUrl;

		if (!pageUrl) {
			throw new Error('The catalog has no page URL for the approved version.');
		}

		const page = await fetch(pageUrl);

		expect(page.status).toBe(200);
		expect(await page.text()).toBe(COMMITTED_ADDON_MD);

		for (const path of MEDIA) {
			const media = await fetch(new URL(path, pageUrl));

			expect(media.status).toBe(200);
			expect(new Uint8Array(await media.arrayBuffer())).toEqual(new Uint8Array(png(64)));
		}
	});

	test('a rejected submission’s media never reach the public bucket', async () => {
		const [author, moderator] = await Promise.all([signUp(), signUp('moderator')]);
		const id = await submitPage(author, 'review-media.rejected');

		await review(moderator, id, { decision: 'rejected', note: 'No.' });

		expect(await findStatus(id)).toBe('rejected');
		expect(await listPublic('review-media.rejected')).toEqual([]);
	});

	test('refuses media whose pinned blobs arrive altered, publishing nothing', async () => {
		const [author, moderator] = await Promise.all([signUp(), signUp('moderator')]);
		const id = await submitPage(author, 'review-media.tampered');

		github.tamper(true);

		try {
			expect(await failure(review(moderator, id, { decision: 'approved' }))).toEqual({
				status: 502,
				code: 'github_unavailable',
			});
		} finally {
			github.tamper(false);
		}

		expect(await findStatus(id)).toBe('pending_review');
		expect(await listPublic('review-media.tampered')).toEqual([]);
	});
});
