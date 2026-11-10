import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { loadSubmissionPreview } from '~/lib/submission-preview';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';
import { user } from '~/db/schema';

import { createTestContext, signInWithDiscord, snowflakeAt } from '../helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from '../helpers/addons';

const { ctx, close } = await createTestContext();

afterAll(close);

let users = 0;

async function signUp(role: Role = 'user'): Promise<Caller> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Preview ${users}`,
		email: `preview-${users}@example.com`,
	});

	await ctx.db.update(user).set({ role }).where(eq(user.id, userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!row) {
		throw new Error(`User ${userId} was not stored.`);
	}

	return { user: row, via: 'session' };
}

describe('loadSubmissionPreview', () => {
	test('shows a reviewer the page with the submitted version on top', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const { id } = await seedSubmission(ctx, author.user.id, manifest('preview.listing'));

		const page = await loadSubmissionPreview(ctx, reviewer, {
			addonId: 'preview.listing',
			submissionId: id,
		});

		expect(page?.versions.map((entry) => entry.version)).toEqual(['1.0.0']);
	});

	test('shows nothing to a caller who may not review the submission', async () => {
		const author = await signUp();
		const { id } = await seedSubmission(ctx, author.user.id, manifest('preview.denied'));

		expect(
			await loadSubmissionPreview(ctx, author, {
				addonId: 'preview.denied',
				submissionId: id,
			}),
		).toBeUndefined();
	});

	test("shows nothing for a submission that is not the named addon's", async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');
		const { id } = await seedSubmission(ctx, author.user.id, manifest('preview.mine'));

		expect(
			await loadSubmissionPreview(ctx, reviewer, {
				addonId: 'preview.other',
				submissionId: id,
			}),
		).toBeUndefined();
	});

	test('shows nothing for a legacy upload without a GitHub source', async () => {
		const author = await signUp();
		const reviewer = await signUp('moderator');

		await seedApprovedAddon(ctx, author.user.id, manifest('preview.legacy'));

		const { id } = await seedSubmission(
			ctx,
			author.user.id,
			manifest('preview.legacy', '1.1.0'),
			{ kind: 'update' },
			null,
		);

		expect(
			await loadSubmissionPreview(ctx, reviewer, {
				addonId: 'preview.legacy',
				submissionId: id,
			}),
		).toBeUndefined();
	});
});
