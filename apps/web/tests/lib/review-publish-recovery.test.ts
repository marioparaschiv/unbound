import { afterAll, describe, expect, test } from 'bun:test';

import { getAddonDetails, getCatalog, listAddons } from '~/lib/addons';
import { listReviewQueue, reviewSubmission } from '~/lib/review';
import { createSubmission } from '~/lib/submissions';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { findUpdates } from '~/lib/updates';

import { commitPlugin, serveGitHub } from '../helpers/github';
import { createTestContext } from '../helpers/context';
import { serveMemoryS3 } from '../helpers/memory-s3';
import { rejection } from '../helpers/server';
import { signUpUser } from '../helpers/users';

const REPOSITORY = 'acme/addons';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

// Refuses every write while `failing`, as a storage outage after the approval committed would.
let failing = false;
const flaky = Bun.serve({
	port: 0,
	fetch(request) {
		if (failing && request.method === 'PUT') {
			return new Response(null, { status: 503 });
		}

		return fetch(new URL(new URL(request.url).pathname, s3.url), request);
	},
});

const { ctx, close } = await createTestContext({
	S3_ENDPOINT: flaky.url.href,
	GITHUB_API_URL: github.url.href,
});

afterAll(async () => {
	await Promise.all([flaky.stop(true), s3.stop(true), github.stop()]);
	await close();
});

async function signUp(role: Role = 'user'): Promise<Caller> {
	return (await signUpUser(ctx, { role, github: 'owner' })).caller;
}

async function submit(author: Caller, id: string, version = '1.0.0') {
	const { request } = commitPlugin(github.repository(REPOSITORY), REPOSITORY, id, version);
	const { submission } = await createSubmission(ctx, author, request);

	return submission.id;
}

function versionOf(addonId: string, version = '1.0.0') {
	return ctx.db.query.addonVersion.findFirst({ where: { addonId, version } });
}

async function approveWithFailingWrite(
	id: string,
	reviewer: Caller,
	addonId: string,
	version = '1.0.0',
) {
	failing = true;

	try {
		expect(
			await rejection(reviewSubmission(ctx, reviewer, id, { decision: 'approved' })),
		).toBeInstanceOf(Error);
	} finally {
		failing = false;
	}

	expect((await versionOf(addonId, version))?.filesPendingSince).toBeInstanceOf(Date);
}

describe('publish recovery through the queue', () => {
	test('an approved version with unwritten files stays queued until any reviewer retries it', async () => {
		const author = await signUp();
		const first = await signUp('moderator');
		const second = await signUp('moderator');
		const id = await submit(author, 'recover.queue');

		await approveWithFailingWrite(id, first, 'recover.queue');

		// A reload reads the queue afresh: no dialog state survives.
		const { submissions } = await listReviewQueue(ctx, second);
		const queued = submissions.find((entry) => entry.submission.id === id);

		expect(queued?.submission.status).toBe('approved');

		await reviewSubmission(ctx, second, id, { decision: 'approved' });

		expect((await versionOf('recover.queue'))?.filesPendingSince).toBeNull();
		expect(
			(await listReviewQueue(ctx, second)).submissions.some(
				(entry) => entry.submission.id === id,
			),
		).toBe(false);
	});

	test('a published version refuses a repeated approval', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const id = await submit(author, 'recover.done');

		await reviewSubmission(ctx, reviewer, id, { decision: 'approved' });

		expect(
			await rejection(reviewSubmission(ctx, reviewer, id, { decision: 'approved' })),
		).toMatchObject({ code: 'submission_not_pending' });
	});

	test('a pending submission is queued without being flagged', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const id = await submit(author, 'recover.pending');
		const { submissions } = await listReviewQueue(ctx, reviewer);

		expect(submissions.find((entry) => entry.submission.id === id)?.submission.status).toBe(
			'pending_review',
		);
	});
});

describe('a version whose files are pending', () => {
	function updatesFrom(addonId: string, version: string) {
		return findUpdates(ctx, { clientVersion: '9.0.0', addons: [{ id: addonId, version }] });
	}

	async function listedVersion(addonId: string) {
		const { addons } = await getCatalog(ctx);

		return addons.find((entry) => entry.id === addonId)?.latestVersion.version;
	}

	test('is not served or listed until its files are written', async () => {
		const author = await signUp('developer');
		const reviewer = await signUp('moderator');
		const addonId = 'recover.served';

		await reviewSubmission(ctx, reviewer, await submit(author, addonId), {
			decision: 'approved',
		});

		const update = await submit(author, addonId, '1.1.0');

		await approveWithFailingWrite(update, reviewer, addonId, '1.1.0');

		expect((await updatesFrom(addonId, '1.0.0')).updates).toEqual([]);
		expect(await listedVersion(addonId)).toBe('1.0.0');
		expect(
			(await getAddonDetails(ctx, addonId))?.versions.map((entry) => entry.version),
		).toEqual(['1.0.0']);

		await reviewSubmission(ctx, reviewer, update, { decision: 'approved' });

		expect((await updatesFrom(addonId, '1.0.0')).updates.map((entry) => entry.version)).toEqual(
			['1.1.0'],
		);
		expect(await listedVersion(addonId)).toBe('1.1.0');
	});

	test('keeps a new listing off the marketplace until its files are written', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const addonId = 'recover.listing';
		const id = await submit(author, addonId);

		await approveWithFailingWrite(id, reviewer, addonId);

		expect(await listedVersion(addonId)).toBeUndefined();
		expect(await getAddonDetails(ctx, addonId)).toBeUndefined();
		expect((await listAddons(ctx)).addons.some((entry) => entry.id === addonId)).toBe(false);

		await reviewSubmission(ctx, reviewer, id, { decision: 'approved' });

		expect(await listedVersion(addonId)).toBe('1.0.0');
	});
});
