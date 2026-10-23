import type {
	ReviewDecision,
	SubmissionKind,
	SubmissionStatus,
} from '@unbound-app/contracts/publish';
import type { UserSummary } from '@unbound-app/contracts/account';

import { toEvent } from '~/lib/moderation-events';
import type { AppContext } from '~/lib/context';

/** One review of a submission, read from its `review.decided` event. */
export type ReviewDecisionRecord = {
	eventId: number;
	decision: ReviewDecision;
	/** `null` once the reviewer's account is deleted. */
	reviewer: UserSummary | null;
	note: string | null;
	decidedAt: string;
};

export type AdminSubmission = {
	id: string;
	addonId: string;
	kind: SubmissionKind;
	status: SubmissionStatus;
	version: string;
	author: UserSummary | null;
	/** The GitHub `owner/name` the author proved push access to. */
	repository: string | null;
	createdAt: Date;
	submittedAt: Date | null;
	/** Every review it received, oldest first; a resubmitted round keeps its earlier decisions. */
	decisions: ReviewDecisionRecord[];
};

/** Whose submissions to list: every one for an addon id, or every one by an author. */
export type SubmissionOwner = { addonId: string } | { authorId: string };

async function listDecisions(
	ctx: AppContext,
	addonIds: string[],
): Promise<Map<string, ReviewDecisionRecord[]>> {
	const decisions = new Map<string, ReviewDecisionRecord[]>();

	if (addonIds.length === 0) {
		return decisions;
	}

	const rows = await ctx.db.query.moderationEvent.findMany({
		where: { subjectType: 'addon', subjectId: { in: addonIds }, kind: 'review.decided' },
		with: { actor: { columns: { id: true, name: true, image: true } } },
		orderBy: { id: 'asc' },
	});

	for (const row of rows) {
		const event = toEvent(row);

		if (event?.kind !== 'review.decided') {
			continue;
		}

		const list = decisions.get(event.data.submissionId) ?? [];

		list.push({
			eventId: event.id,
			decision: event.data.decision,
			reviewer: event.actor,
			note: event.reason,
			decidedAt: event.createdAt,
		});
		decisions.set(event.data.submissionId, list);
	}

	return decisions;
}

/**
 * @description Lists submissions newest first, each with every review decision it received. Callers
 * check the staff permission first.
 * @param ctx The application context.
 * @param owner The addon id or the author whose submissions to list.
 * @returns The submissions with their decisions.
 */
export async function listSubmissionHistory(
	ctx: AppContext,
	owner: SubmissionOwner,
): Promise<AdminSubmission[]> {
	const rows = await ctx.db.query.submission.findMany({
		where: owner,
		columns: {
			id: true,
			addonId: true,
			kind: true,
			status: true,
			version: true,
			repository: true,
			createdAt: true,
			submittedAt: true,
		},
		with: { author: { columns: { id: true, name: true, image: true } } },
		orderBy: { createdAt: 'desc', id: 'desc' },
	});
	const decisions = await listDecisions(ctx, [...new Set(rows.map((row) => row.addonId))]);

	return rows.map(({ author, ...row }) => ({
		...row,
		author: author ? { id: author.id, name: author.name, image: author.image ?? null } : null,
		decisions: decisions.get(row.id) ?? [],
	}));
}

export default { listSubmissionHistory };
