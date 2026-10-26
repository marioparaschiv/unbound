import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import { createApiClient } from '~/api/client';
import { submission } from '~/db/schema';
import type { Api } from '~/api';

import { S3_TEST_ENV, createTestContext, linkGitHub, signInWithDiscord } from './helpers/context';
import { commitPlugin, serveGitHub } from './helpers/github';
import { serveEndpoints } from './helpers/server';

const REPOSITORY = 'acme/addons';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);
const { ctx, close } = await createTestContext({ ...S3_TEST_ENV, GITHUB_API_URL: github.url.href });
const server = serveEndpoints(ctx, { 'POST /api/v1/submissions': createSubmissionEndpoint });

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await server.stop(true);
	await github.stop();
	await close();
});

let users = 0;

async function signUp() {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Publisher ${users}`,
		email: `publisher-${users}@example.com`,
	});

	await linkGitHub(ctx, userId, 'owner');

	return createApiClient<Api>({ baseUrl: server.url.href, headers });
}

type Client = Awaited<ReturnType<typeof signUp>>;

function create(client: Client, request: CreateSubmissionRequest) {
	return client('POST /api/v1/submissions', {
		body: request,
		response: createSubmissionResponseSchema,
	});
}

async function findRow(id: string) {
	const [row] = await ctx.db.select().from(submission).where(eq(submission.id, id));

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	return row;
}

describe('submitting from GitHub', () => {
	test('stages exactly the bundle committed at the pinned commit', async () => {
		const client = await signUp();
		const { request, bundle } = commitPlugin(fixture, REPOSITORY, 's3.publish');
		const { submission: created } = await create(client, request);
		const row = await findRow(created.id);

		expect(created.status).toBe('pending_review');
		expect(row.sha256).toBe(new Bun.CryptoHasher('sha256').update(bundle).digest('hex'));
		expect(await ctx.storage.staging.file(row.stagingKey).text()).toBe(bundle);
	});
});

describe('republishing', () => {
	test('after changes are requested, a new submission replaces the staged bundle', async () => {
		const client = await signUp();
		const first = await create(
			client,
			commitPlugin(fixture, REPOSITORY, 's3.republish').request,
		);

		await ctx.db
			.update(submission)
			.set({ status: 'changes_requested' })
			.where(eq(submission.id, first.submission.id));

		const next = commitPlugin(fixture, REPOSITORY, 's3.republish', '1.0.0', {
			'dist/index.js': 'export default "fixed";',
		});
		const second = await create(client, next.request);
		const replaced = await findRow(first.submission.id);

		expect(replaced.status).toBe('superseded');
		expect(await ctx.storage.staging.exists(replaced.stagingKey)).toBe(false);
		expect(
			await ctx.storage.staging.file((await findRow(second.submission.id)).stagingKey).text(),
		).toBe('export default "fixed";');
	});
});
