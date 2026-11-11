import { afterAll, describe, expect, test } from 'bun:test';

import { createSubmission } from '~/lib/submissions';
import { reviewSubmission } from '~/lib/review';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { commitPlugin, serveGitHub } from '../helpers/github';
import { createTestContext } from '../helpers/context';
import { serveMemoryS3 } from '../helpers/memory-s3';
import { signUpUser } from '../helpers/users';
import { manifest } from '../helpers/addons';

const REPOSITORY = 'acme/addons';

const s3 = serveMemoryS3();
const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const { ctx, close } = await createTestContext({
	S3_ENDPOINT: s3.url.href,
	GITHUB_API_URL: github.url.href,
});

afterAll(async () => {
	await Promise.all([s3.stop(true), github.stop()]);
	await close();
});

async function signUp(role: Role = 'user'): Promise<Caller> {
	return (await signUpUser(ctx, { role, github: 'owner' })).caller;
}

describe('approval', () => {
	test('publishes the compiled bundles a submission ships', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const compiled = new TextEncoder().encode('hermes bytecode 98');
		const sha512 = new Bun.CryptoHasher('sha512').update(compiled).digest('hex');
		const { request } = commitPlugin(
			github.repository(REPOSITORY),
			REPOSITORY,
			'review.bytecode',
			'1.0.0',
			{
				'manifest.json': JSON.stringify({
					...manifest('review.bytecode'),
					main: 'src/index.ts',
					bytecode: { '98': sha512 },
				}),
				'dist/index.98.hbc': compiled,
			},
		);
		const { submission } = await createSubmission(ctx, author, request);

		await reviewSubmission(ctx, reviewer, submission.id, { decision: 'approved' });

		const published = ctx.storage.public.file('addons/review.bytecode/1.0.0/index.98.hbc');

		expect(await published.exists()).toBe(true);
		expect(await published.bytes()).toEqual(compiled);
	});
});
