import type {
	ModerationEvent,
	ModerationEventData,
	ModerationEventPage,
	Subject,
	SubjectType,
} from '@unbound-app/contracts/admin';
import { moderationEventSchema } from '@unbound-app/contracts/admin';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import type { UserSummary } from '@unbound-app/contracts/account';
import { createLogger } from '@unbound-app/logger';
import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import type { Database, Transaction } from '~/db/database';
import type { SubmissionRow } from '~/lib/submissions';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { moderationEvent, staffNote, submission, user } from '~/db/schema';

/** Who acted, when and why; the subject is implied by the action. */
export type ActionMeta = {
	actorId: string | null;
	at: Date;
	reason?: string | null;
};

export type EventMeta = ActionMeta & { subject: Subject };

export type EventEntry = EventMeta & ModerationEventData;

export type EventRow = typeof moderationEvent.$inferSelect & {
	actor: { id: string; name: string; image: string | null } | null;
};

export type EventTimeline = ModerationEventPage & {
	/** The users the events name only by id, such as the members of a maintainer change. */
	users: Record<string, UserSummary>;
};

/** A Better Auth admin endpoint call, as its after-hook sees it. */
export type AuthAdminAction = {
	/** The endpoint path, e.g. `/admin/ban-user`. */
	path: string;
	/** The signed-in staff member who called it. */
	actorId: string | null;
	at: Date;
	/** The request body, as the endpoint accepted it. */
	body: unknown;
	/** The endpoint's response; an error when the action failed. */
	returned: unknown;
};

type AuthAdminEvent = ModerationEventData & Pick<EventMeta, 'reason'>;

const authUserSchema = z.object({
	user: z.object({
		id: z.string().min(1),
		role: z.string().nullish(),
		banExpires: z.coerce.date().nullish(),
	}),
});

const authBodySchema = z.object({ banReason: z.string().trim().optional() });

type AuthUser = z.infer<typeof authUserSchema>['user'];

type AuthBody = z.infer<typeof authBodySchema>;

const AUTH_ADMIN_EVENTS = {
	'/admin/ban-user': (target: AuthUser, body: AuthBody): AuthAdminEvent => ({
		kind: 'user.banned',
		data: { expiresAt: target.banExpires?.toISOString() ?? null },
		reason: body.banReason || null,
	}),
	'/admin/unban-user': (): AuthAdminEvent => ({ kind: 'user.unbanned', data: {} }),
	'/admin/set-role': (target: AuthUser): AuthAdminEvent => ({
		kind: 'user.role_set',
		data: { role: target.role ?? '' },
	}),
};

type AuthAdminPath = keyof typeof AUTH_ADMIN_EVENTS;

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

/**
 * @description Parses a stored event row at the database boundary.
 * @param row The row, loaded with its actor.
 * @returns The event, or `undefined` (logged) when the row no longer matches its kind's schema.
 */
export function toEvent(row: EventRow): ModerationEvent | undefined {
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

function mentionedUserIds(events: ModerationEvent[]): string[] {
	const ids = new Set<string>();

	for (const event of events) {
		if (event.kind !== 'addon.maintainers_changed') {
			continue;
		}

		for (const member of [...event.data.before, ...event.data.after]) {
			ids.add(member.userId);
		}
	}

	return [...ids];
}

/**
 * @description Lists a page of a subject's events, as {@link listEvents} does, with the users the
 * events name only by id, so a timeline can show names.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param subject The addon or user.
 * @param before The previous page's `before`, for older events.
 * @returns The page and the users it names.
 */
export async function getEventTimeline(
	ctx: AppContext,
	caller: Caller,
	subject: Subject,
	before?: number,
): Promise<EventTimeline> {
	const page = await listEvents(ctx, caller, subject, before);
	const ids = mentionedUserIds(page.items);
	const rows = ids.length
		? await ctx.db.query.user.findMany({
				where: { id: { in: ids } },
				columns: { id: true, name: true, image: true },
			})
		: [];

	const users: Record<string, UserSummary> = {};

	for (const row of rows) {
		users[row.id] = { id: row.id, name: row.name, image: row.image ?? null };
	}

	return { ...page, users };
}

function isAuthAdminPath(path: string): path is AuthAdminPath {
	return Object.hasOwn(AUTH_ADMIN_EVENTS, path);
}

/**
 * @description Records a Better Auth ban, unban or role change against the user it targeted. Calls
 * to other endpoints, and calls that failed, record nothing.
 * @param db The database.
 * @param action The endpoint call.
 */
export function recordAuthAdminAction(db: Database, action: AuthAdminAction): void {
	const { path, actorId, at, body, returned } = action;

	if (!isAuthAdminPath(path)) return;

	const parsed = authUserSchema.safeParse(returned);

	if (!parsed.success) return;

	const target = parsed.data.user;
	const event = AUTH_ADMIN_EVENTS[path](target, authBodySchema.parse(body));

	db.transaction((tx) => {
		appendEvent(tx, { subject: { type: 'user', id: target.id }, actorId, at, ...event });
	});
}

/**
 * @description Deletes a user and records `user.deleted` in one transaction, counting the open
 * submissions and staff notes the cascade removes. A failed delete records nothing.
 * @param db The database.
 * @param userId The user to delete.
 * @param meta Who deleted them, and when.
 */
export function deleteUserWithRecord(db: Database, userId: string, meta: ActionMeta): void {
	db.transaction((tx) => {
		const submissions = tx
			.select({ total: count() })
			.from(submission)
			.where(
				and(
					eq(submission.authorId, userId),
					inArray(submission.status, openSubmissionStatusSchema.options),
				),
			)
			.get();

		const notes = tx
			.select({ total: count() })
			.from(staffNote)
			.where(eq(staffNote.userId, userId))
			.get();

		appendEvent(tx, {
			subject: { type: 'user', id: userId },
			...meta,
			kind: 'user.deleted',
			data: {
				openSubmissions: submissions?.total ?? 0,
				staffNotes: notes?.total ?? 0,
			},
		});

		tx.delete(user).where(eq(user.id, userId)).run();
	});
}

export default {
	appendEvent,
	recordReviewDecision,
	queryEvents,
	toEvent,
	listEvents,
	getEventTimeline,
	recordAuthAdminAction,
	deleteUserWithRecord,
};
