import type {
	ModerationEvent,
	ModerationEventData,
	ModerationEventPage,
	Subject,
	SubjectType,
} from '@unbound-app/contracts/admin';
import { moderationEventSchema } from '@unbound-app/contracts/admin';
import { createLogger } from '@unbound-app/logger';

import type { SubmissionRow } from '~/lib/submissions';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { moderationEvent } from '~/db/schema';

/** Who acted, when and why; the subject is implied by the action. */
export type ActionMeta = {
	actorId: string | null;
	at: Date;
	reason?: string | null;
};

export type EventMeta = ActionMeta & { subject: Subject };

export type EventEntry = EventMeta & ModerationEventData;

type EventRow = typeof moderationEvent.$inferSelect & {
	actor: { id: string; name: string; image: string | null } | null;
};

const logger = createLogger('Web', 'Moderation');

const READ_PERMISSIONS: Record<SubjectType, Permissions> = {
	addon: { addon: ['delist'] },
	user: { user: ['get'] },
};

/**
 * @description Appends one moderation event inside the caller's transaction, so the action and its
 * record commit together.
 * @param tx The action's transaction.
 * @param entry The subject, actor, time, reason, kind and payload.
 * @returns The event id.
 */
export function appendEvent(tx: Transaction, entry: EventEntry): number {
	const { subject, actorId, at, reason = null, kind, data } = entry;

	const { id } = tx
		.insert(moderationEvent)
		.values({
			subjectType: subject.type,
			subjectId: subject.id,
			actorId,
			kind,
			data,
			reason,
			createdAt: at,
		})
		.returning({ id: moderationEvent.id })
		.get();

	return id;
}

/**
 * @description Records a review decision, with its reviewer, note and time, as `review.decided`.
 * @param tx The review's transaction.
 * @param reviewed The submission as the decision left it.
 */
export function recordReviewDecision(tx: Transaction, reviewed: SubmissionRow): void {
	const { reviewDecision, reviewedAt } = reviewed;

	if (!reviewDecision || !reviewedAt) {
		throw new Error(`Submission ${reviewed.id} has no review decision to record.`);
	}

	appendEvent(tx, {
		subject: { type: 'addon', id: reviewed.addonId },
		actorId: reviewed.reviewerId,
		at: reviewedAt,
		reason: reviewed.reviewNote,
		kind: 'review.decided',
		data: {
			submissionId: reviewed.id,
			submissionKind: reviewed.kind,
			version: reviewed.version,
			decision: reviewDecision,
		},
	});
}

/**
 * @description Builds the one statement behind {@link listEvents}: a page of the subject's events
 * plus a lookahead row, newest first, keyset-paginated on the id.
 * @param ctx The application context.
 * @param subject The addon or user.
 * @param before Only events older than this id.
 * @returns The unexecuted relational query.
 */
export function queryEvents(ctx: AppContext, subject: Subject, before?: number) {
	return ctx.db.query.moderationEvent.findMany({
		where: {
			subjectType: subject.type,
			subjectId: subject.id,
			id: before === undefined ? undefined : { lt: before },
		},
		with: { actor: { columns: { id: true, name: true, image: true } } },
		orderBy: { id: 'desc' },
		limit: ctx.env.EVENT_PAGE_SIZE + 1,
	});
}

function toEvent(row: EventRow): ModerationEvent | undefined {
	const parsed = moderationEventSchema.safeParse({
		id: row.id,
		subject: { type: row.subjectType, id: row.subjectId },
		actor: row.actor,
		kind: row.kind,
		data: row.data,
		reason: row.reason,
		createdAt: row.createdAt.toISOString(),
	});

	if (!parsed.success) {
		logger.warn(`Skipping moderation event ${row.id}, which no longer parses:`, parsed.error);

		return;
	}

	return parsed.data;
}

/**
 * @description Lists a subject's moderation events, newest first. Addon subjects need
 * `addon:delist`, user subjects `user:get`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param subject The addon or user.
 * @param before The previous page's `before`, for older events.
 * @returns The page; rows that no longer match their kind's schema are logged and skipped.
 */
export async function listEvents(
	ctx: AppContext,
	caller: Caller,
	subject: Subject,
	before?: number,
): Promise<ModerationEventPage> {
	requirePermission(caller, READ_PERMISSIONS[subject.type]);

	const size = ctx.env.EVENT_PAGE_SIZE;
	const rows = await queryEvents(ctx, subject, before);
	const page = rows.slice(0, size);
	const last = page.at(-1);

	return {
		items: page.flatMap((row) => toEvent(row) ?? []),
		before: rows.length > size && last ? last.id : null,
	};
}

export default { appendEvent, recordReviewDecision, queryEvents, listEvents };
