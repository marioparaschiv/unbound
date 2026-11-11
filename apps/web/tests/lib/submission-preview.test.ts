import { afterAll, describe, expect, test } from 'bun:test';

import { loadSubmissionPreview } from '~/lib/submission-preview';
import type { Caller } from '~/lib/api/caller';
import type { Role } from '~/lib/auth/access';

import { manifest, seedApprovedAddon, seedSubmission } from '../helpers/addons';
import { createTestContext } from '../helpers/context';
import { signUpUser } from '../helpers/users';

const { ctx, close } = await createTestContext();

afterAll(close);

async function signUp(role: Role = 'user'): Promise<Caller> {
	return (await signUpUser(ctx, { role })).caller;
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
