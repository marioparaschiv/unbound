import type { ReviewDecision } from '@unbound-app/contracts/publish';
import { and, eq } from 'drizzle-orm';

import { recordReviewDecision } from '~/lib/moderation-events';
import type { SubmissionRow } from '~/lib/submissions';
import type { Transaction } from '~/db/database';
import { ApiError } from '~/lib/api/errors';
import { submission } from '~/db/schema';

/** A reviewer's decision on a submission. */
export type Decision = {
	decision: ReviewDecision;
	note: string | null;
	reviewerId: string;
	reviewedAt: Date;
};

/**
 * @description Records a decision on a submission still pending review, and its moderation event.
 * Anything but `pending_review` means another reviewer decided first.
 * @param tx The decision's transaction.
 * @param row The submission.
 * @param decision The decision.
 * @returns The decided submission; throws `submission_not_pending` when it was already decided.
 */
export async function decideSubmission(
	tx: Transaction,
	row: SubmissionRow,
	decision: Decision,
): Promise<SubmissionRow> {
	const [updated] = await tx
		.update(submission)
		.set({
			status: decision.decision,
			reviewDecision: decision.decision,
			reviewNote: decision.note,
			reviewerId: decision.reviewerId,
			reviewedAt: decision.reviewedAt,
		})
		.where(and(eq(submission.id, row.id), eq(submission.status, 'pending_review')))
		.returning();

	if (!updated) {
		throw new ApiError('submission_not_pending', `Submission ${row.id} was already reviewed.`);
	}

	await recordReviewDecision(tx, updated);

	return updated;
}

export default { decideSubmission };
