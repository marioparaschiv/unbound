import { addonTypeSchema, maintainerRoleSchema, sortOrderSchema } from './addons';
import { reviewDecisionSchema, submissionKindSchema } from './publish';
import { userSummarySchema } from './account';
import { repositorySchema } from './source';
import { semverSchema } from './manifest';
import { z } from './zod';

export const subjectTypeSchema = z.enum(['addon', 'user']);

/** What a moderation event or staff note is about: an addon id or a user id. */
export const subjectSchema = z.object({
	type: subjectTypeSchema,
	id: z.string().check(z.minLength(1)),
});

export const maintainerEntrySchema = z.object({
	userId: z.string().check(z.minLength(1)),
	role: maintainerRoleSchema,
});

/** Summary fields a staff edit can pin; unpinned ones follow the served version's manifest. */
export const pinnableFieldSchema = z.enum(['name', 'description', 'type']);

export const editableFieldSchema = z.enum([...pinnableFieldSchema.options, 'repository']);

export const fieldChangeSchema = z.object({
	field: editableFieldSchema,
	from: z.nullable(z.string()),
	to: z.nullable(z.string()),
	/** Whether `to` is a staff value (pinned) or follows the manifest. Always false for `repository`. */
	pinned: z.boolean(),
});

/** One entry per moderation action. `kind` and `data` map 1:1 to the `moderation_event` columns. */
export const moderationEventDataSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('review.decided'),
		data: z.object({
			submissionId: z.string(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
			decision: reviewDecisionSchema,
			/** Set when CI published a first-party addon from a build commit, without a human review. */
			build: z.optional(
				z.object({ repository: z.string(), commitSha: z.string(), ref: z.string() }),
			),
		}),
	}),
	z.object({ kind: z.literal('addon.delisted'), data: z.object({}) }),
	z.object({ kind: z.literal('addon.relisted'), data: z.object({}) }),
	z.object({
		kind: z.literal('addon.maintainers_changed'),
		data: z.object({
			before: z.array(maintainerEntrySchema),
			after: z.array(maintainerEntrySchema),
		}),
	}),
	z.object({
		kind: z.literal('addon.edited'),
		data: z.object({ changes: z.array(fieldChangeSchema) }),
	}),
	z.object({
		kind: z.literal('addon.rollback'),
		data: z.object({
			from: z.nullable(semverSchema),
			to: semverSchema,
			withdrawn: z.array(semverSchema),
			restored: z.array(semverSchema),
		}),
	}),
	z.object({
		kind: z.literal('user.banned'),
		data: z.object({ expiresAt: z.nullable(z.iso.datetime()) }),
	}),
	z.object({ kind: z.literal('user.unbanned'), data: z.object({}) }),
	z.object({ kind: z.literal('user.role_set'), data: z.object({ role: z.string() }) }),
	/** Written just before the delete; the counts are what the cascade then removes with the user. */
	z.object({
		kind: z.literal('user.deleted'),
		data: z.object({
			openSubmissions: z.int().check(z.nonnegative()),
			staffNotes: z.int().check(z.nonnegative()),
		}),
	}),
	z.object({
		kind: z.literal('note.added'),
		data: z.object({ noteId: z.int(), body: z.string() }),
	}),
	z.object({
		kind: z.literal('note.edited'),
		data: z.object({ noteId: z.int(), before: z.string(), body: z.string() }),
	}),
	z.object({
		kind: z.literal('note.deleted'),
		data: z.object({ noteId: z.int(), body: z.string() }),
	}),
	z.object({
		kind: z.literal('submission.created'),
		data: z.object({
			submissionId: z.string(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
			/** The author's own submission with changes requested that this one replaced. */
			supersededId: z.nullable(z.string()),
		}),
	}),
	/** Banning the author cancels each of their open submissions; no user acts. */
	z.object({
		kind: z.literal('submission.cancelled'),
		data: z.object({
			submissionId: z.string(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
		}),
	}),
]);

export const moderationEventSchema = z.intersection(
	moderationEventDataSchema,
	z.object({
		id: z.int(),
		subject: subjectSchema,
		/** `null` once the acting user is deleted. */
		actor: z.nullable(userSummarySchema),
		/** The human "why": a review note, a rollback reason, an edit reason. */
		reason: z.nullable(z.string()),
		createdAt: z.iso.datetime(),
	}),
);

/** A subject's events, newest first. */
export const moderationEventPageSchema = z.object({
	items: z.array(moderationEventSchema),
	/** Pass as `before` for older events; `null` on the last page. */
	before: z.nullable(z.int()),
});

/** A page of a subject's events older than `before`, or the newest page without it. */
export const moderationEventPageRequestSchema = z.object({
	subject: subjectSchema,
	before: z.optional(z.int()),
});

/** Which way to page from `cursor`: `next` reads the rows after it, `prev` the rows before it. */
export const pageDirectionSchema = z.enum(['next', 'prev']);

/** The shortest search the trigram index can match. */
export const ADMIN_SEARCH_MIN_LENGTH = 3;

export const ADMIN_SEARCH_MAX_LENGTH = 100;

/** Matches a substring of the indexed text, case-insensitively. */
export const adminSearchTextSchema = z
	.string()
	.check(
		z.trim(),
		z.minLength(
			ADMIN_SEARCH_MIN_LENGTH,
			`Search for at least ${ADMIN_SEARCH_MIN_LENGTH} characters.`,
		),
		z.maxLength(
			ADMIN_SEARCH_MAX_LENGTH,
			`Search for at most ${ADMIN_SEARCH_MAX_LENGTH} characters.`,
		),
	);

const keysetSearch = {
	/** The `next` or `prev` cursor of the page the request pages from, sent with the same filters. */
	cursor: z.optional(z.string().check(z.maxLength(512))),
	/** Defaults to `next`. */
	dir: z.optional(pageDirectionSchema),
};

/** The admin users list, newest first. `q` matches the id, name or email. */
export const adminUsersSearchSchema = z.object({
	q: z.optional(adminSearchTextSchema),
	...keysetSearch,
});

/** `pending_review` and `changes_requested`: the addon has an update submission in that status. */
export const adminAddonStatusSchema = z.enum([
	'listed',
	'delisted',
	'pending_review',
	'changes_requested',
]);

/** The admin addons list, by first approval. Every filter narrows; `q` matches the id or name. */
export const adminAddonsSearchSchema = z.object({
	q: z.optional(adminSearchTextSchema),
	type: z.optional(addonTypeSchema),
	status: z.optional(adminAddonStatusSchema),
	/** A user id: the addons they own or maintain. */
	maintainer: z.optional(z.string().check(z.minLength(1), z.maxLength(64))),
	/** The first day of first approval, inclusive, in UTC. */
	publishedFrom: z.optional(z.iso.date()),
	/** The last day of first approval, inclusive, in UTC. */
	publishedTo: z.optional(z.iso.date()),
	/** Defaults to `desc`, newest first. */
	order: z.optional(sortOrderSchema),
	...keysetSearch,
});

/** The human "why" a staff action records with its event. */
export const moderationReasonSchema = z
	.string()
	.check(
		z.trim(),
		z.minLength(1, 'Give a reason.'),
		z.maxLength(2000, 'Keep the reason under 2000 characters.'),
	);

/** Makes `version` the one the addon serves; serving the pre-rollback version undoes a rollback. */
export const serveVersionRequestSchema = z.object({
	version: semverSchema,
	reason: moderationReasonSchema,
});

/**
 * The whole desired state of an addon from the staff edit form. Each changed group needs its own
 * permission: metadata `addon:edit`, `delisted` `addon:delist`, `maintainers` `addon:transfer`.
 */
export const editAddonRequestSchema = z.object({
	/** The `revision` the form loaded; a mismatch is `edit_conflict`. */
	revision: z.string().check(z.length(64)),
	/** `null` unpins: the field follows the served version's manifest again. */
	name: z.nullable(
		z
			.string()
			.check(
				z.trim(),
				z.minLength(1, 'Give a name.'),
				z.maxLength(100, 'Keep the name under 100 characters.'),
			),
	),
	description: z.nullable(
		z
			.string()
			.check(z.trim(), z.maxLength(1000, 'Keep the description under 1000 characters.')),
	),
	type: z.nullable(addonTypeSchema),
	repository: z.nullable(repositorySchema),
	delisted: z.boolean(),
	maintainers: z.array(maintainerEntrySchema).check(
		z.refine(
			(list) => new Set(list.map((member) => member.userId)).size === list.length,
			'List each user once.',
		),
		z.refine(
			(list) => list.some((member) => member.role === 'owner'),
			'An addon needs an owner.',
		),
	),
	reason: z.optional(moderationReasonSchema),
});

export const staffNoteBodySchema = z
	.string()
	.check(
		z.trim(),
		z.minLength(1, 'Write a note.'),
		z.maxLength(5000, 'Keep a note to 5000 characters.'),
	);

export const staffNoteIdSchema = z.int().check(z.positive());

/** A new note on one user or addon. */
export const createStaffNoteRequestSchema = z.object({
	subject: subjectSchema,
	body: staffNoteBodySchema,
});

/** Replaces the body of the caller's own note. */
export const editStaffNoteRequestSchema = z.object({
	id: staffNoteIdSchema,
	body: staffNoteBodySchema,
});

/** Deletes the caller's own note. */
export const deleteStaffNoteRequestSchema = z.object({ id: staffNoteIdSchema });

export type SubjectType = z.infer<typeof subjectTypeSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type MaintainerEntry = z.infer<typeof maintainerEntrySchema>;
export type PinnableField = z.infer<typeof pinnableFieldSchema>;
export type EditableField = z.infer<typeof editableFieldSchema>;
export type FieldChange = z.infer<typeof fieldChangeSchema>;
export type ModerationEventData = z.infer<typeof moderationEventDataSchema>;
export type ModerationEventKind = ModerationEventData['kind'];
export type ModerationEvent = z.infer<typeof moderationEventSchema>;
export type ModerationEventPage = z.infer<typeof moderationEventPageSchema>;
export type ModerationEventPageRequest = z.infer<typeof moderationEventPageRequestSchema>;
export type PageDirection = z.infer<typeof pageDirectionSchema>;
export type AdminUsersSearch = z.infer<typeof adminUsersSearchSchema>;
export type AdminAddonStatus = z.infer<typeof adminAddonStatusSchema>;
export type AdminAddonsSearch = z.infer<typeof adminAddonsSearchSchema>;
export type ServeVersionRequest = z.infer<typeof serveVersionRequestSchema>;
export type EditAddonRequest = z.infer<typeof editAddonRequestSchema>;
export type CreateStaffNoteRequest = z.infer<typeof createStaffNoteRequestSchema>;
export type EditStaffNoteRequest = z.infer<typeof editStaffNoteRequestSchema>;
export type DeleteStaffNoteRequest = z.infer<typeof deleteStaffNoteRequestSchema>;

export default {
	subjectTypeSchema,
	subjectSchema,
	maintainerEntrySchema,
	pinnableFieldSchema,
	editableFieldSchema,
	fieldChangeSchema,
	moderationEventDataSchema,
	moderationEventSchema,
	moderationEventPageSchema,
	moderationEventPageRequestSchema,
	pageDirectionSchema,
	ADMIN_SEARCH_MIN_LENGTH,
	ADMIN_SEARCH_MAX_LENGTH,
	adminSearchTextSchema,
	adminUsersSearchSchema,
	adminAddonStatusSchema,
	adminAddonsSearchSchema,
	moderationReasonSchema,
	serveVersionRequestSchema,
	editAddonRequestSchema,
	staffNoteBodySchema,
	staffNoteIdSchema,
	createStaffNoteRequestSchema,
	editStaffNoteRequestSchema,
	deleteStaffNoteRequestSchema,
};
