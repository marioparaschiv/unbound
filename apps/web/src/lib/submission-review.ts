import type { ReviewDecision } from '@unbound-app/contracts/publish';

/** The review columns of a submission row, all `null` until a reviewer decides. */
export type ReviewColumns = {
	reviewDecision: ReviewDecision | null;
	reviewedAt: Date | null;
	reviewNote: string | null;
};

/** A decided review: the decision, its note and when it was made. */
export type SubmissionReview = {
	decision: ReviewDecision;
	note: string | null;
	reviewedAt: Date;
};

/**
 * @description Reads a submission's review from its row.
 * @param row The submission's review columns.
 * @returns The review, or `null` until both its decision and time are recorded.
 */
export function readReview(row: ReviewColumns): SubmissionReview | null {
	const { reviewDecision, reviewedAt, reviewNote } = row;

	if (!reviewDecision || !reviewedAt) return null;

	return { decision: reviewDecision, note: reviewNote, reviewedAt };
}

export default { readReview };
