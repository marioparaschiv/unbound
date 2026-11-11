import { addonTypeSchema, maintainerRoleSchema, sortOrderSchema } from './addons';
import { reviewDecisionSchema, submissionKindSchema } from './publish';
import { Type, type StaticDecode, trimmedString } from './schema';
import { userSummarySchema } from './account';
import { repositorySchema } from './source';
import { semverSchema } from './manifest';

export const subjectTypeSchema = Type.Enum(['addon', 'user']);

/** What a moderation event or staff note is about: an addon id or a user id. */
export const subjectSchema = Type.Object({
	type: subjectTypeSchema,
	id: Type.String({ minLength: 1 }),
});

export const maintainerEntrySchema = Type.Object({
	userId: Type.String({ minLength: 1 }),
	role: maintainerRoleSchema,
});

/** Summary fields a staff edit can pin; unpinned ones follow the served version's manifest. */
export const PINNABLE_FIELDS = ['name', 'description', 'type'] as const;

export const EDITABLE_FIELDS = [...PINNABLE_FIELDS, 'repository', 'icon'] as const;

export const pinnableFieldSchema = Type.Enum(PINNABLE_FIELDS);

export const editableFieldSchema = Type.Enum(EDITABLE_FIELDS);

export const fieldChangeSchema = Type.Object({
	field: editableFieldSchema,
	from: Type.Union([Type.String(), Type.Null()]),
	to: Type.Union([Type.String(), Type.Null()]),
	/** Whether `to` is a staff value (pinned) or follows the manifest. Always false for `repository` and `icon`. */
	pinned: Type.Boolean(),
});

/** One entry per moderation action. `kind` and `data` map 1:1 to the `moderation_event` columns. */
export const moderationEventDataSchema = Type.Union([
	Type.Object({
		kind: Type.Literal('review.decided'),
		data: Type.Object({
			submissionId: Type.String(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
			decision: reviewDecisionSchema,
			/** Set when CI published a first-party addon from a build commit, without a human review. */
			build: Type.Optional(
				Type.Object({
					repository: Type.String(),
					commitSha: Type.String(),
					ref: Type.String(),
				}),
			),
		}),
	}),
	Type.Object({ kind: Type.Literal('addon.delisted'), data: Type.Object({}) }),
	Type.Object({ kind: Type.Literal('addon.relisted'), data: Type.Object({}) }),
	Type.Object({
		kind: Type.Literal('addon.maintainers_changed'),
		data: Type.Object({
			before: Type.Array(maintainerEntrySchema),
			after: Type.Array(maintainerEntrySchema),
		}),
	}),
	Type.Object({
		kind: Type.Literal('addon.edited'),
		data: Type.Object({ changes: Type.Array(fieldChangeSchema) }),
	}),
	Type.Object({
		kind: Type.Literal('addon.rollback'),
		data: Type.Object({
			from: Type.Union([semverSchema, Type.Null()]),
			to: semverSchema,
			withdrawn: Type.Array(semverSchema),
			restored: Type.Array(semverSchema),
		}),
	}),
	Type.Object({
		kind: Type.Literal('user.banned'),
		data: Type.Object({
			expiresAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
		}),
	}),
	Type.Object({ kind: Type.Literal('user.unbanned'), data: Type.Object({}) }),
	Type.Object({
		kind: Type.Literal('user.role_set'),
		data: Type.Object({ role: Type.String() }),
	}),
	/** Written just before the delete; the counts are what the cascade then removes with the user. */
	Type.Object({
		kind: Type.Literal('user.deleted'),
		data: Type.Object({
			openSubmissions: Type.Integer({ minimum: 0 }),
			staffNotes: Type.Integer({ minimum: 0 }),
		}),
	}),
	Type.Object({
		kind: Type.Literal('note.added'),
		data: Type.Object({ noteId: Type.Integer(), body: Type.String() }),
	}),
	Type.Object({
		kind: Type.Literal('note.edited'),
		data: Type.Object({ noteId: Type.Integer(), before: Type.String(), body: Type.String() }),
	}),
	Type.Object({
		kind: Type.Literal('note.deleted'),
		data: Type.Object({ noteId: Type.Integer(), body: Type.String() }),
	}),
	Type.Object({
		kind: Type.Literal('submission.created'),
		data: Type.Object({
			submissionId: Type.String(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
			/** The author's own submission with changes requested that this one replaced. */
			supersededId: Type.Union([Type.String(), Type.Null()]),
		}),
	}),
	/** Banning the author cancels each of their open submissions; no user acts. */
	Type.Object({
		kind: Type.Literal('submission.cancelled'),
		data: Type.Object({
			submissionId: Type.String(),
			submissionKind: submissionKindSchema,
			version: semverSchema,
		}),
	}),
]);

export const moderationEventSchema = Type.Intersect([
	moderationEventDataSchema,
	Type.Object({
		id: Type.Integer(),
		subject: subjectSchema,
		/** `null` once the acting user is deleted. */
		actor: Type.Union([userSummarySchema, Type.Null()]),
		/** The human "why": a review note, a rollback reason, an edit reason. */
		reason: Type.Union([Type.String(), Type.Null()]),
		createdAt: Type.String({ format: 'date-time' }),
	}),
]);

/** A subject's events, newest first. */
export const moderationEventPageSchema = Type.Object({
	items: Type.Array(moderationEventSchema),
	/** Pass as `before` for older events; `null` on the last page. */
	before: Type.Union([Type.Integer(), Type.Null()]),
});

/** A page of a subject's events older than `before`, or the newest page without it. */
export const moderationEventPageRequestSchema = Type.Object({
	subject: subjectSchema,
	before: Type.Optional(Type.Integer()),
});

/** Which way to page from `cursor`: `next` reads the rows after it, `prev` the rows before it. */
export const pageDirectionSchema = Type.Enum(['next', 'prev']);

/** The shortest search the trigram index can match. */
export const ADMIN_SEARCH_MIN_LENGTH = 3;

export const ADMIN_SEARCH_MAX_LENGTH = 100;

/** Matches a substring of the indexed text, case-insensitively. */
export const adminSearchTextSchema = trimmedString(
	(value) =>
		value.length < ADMIN_SEARCH_MIN_LENGTH
			? `Search for at least ${ADMIN_SEARCH_MIN_LENGTH} characters.`
			: undefined,
	(value) =>
		value.length > ADMIN_SEARCH_MAX_LENGTH
			? `Search for at most ${ADMIN_SEARCH_MAX_LENGTH} characters.`
			: undefined,
);

const keysetSearch = {
	/** The `next` or `prev` cursor of the page the request pages from, sent with the same filters. */
	cursor: Type.Optional(Type.String({ maxLength: 512 })),
	/** Defaults to `next`. */
	dir: Type.Optional(pageDirectionSchema),
};

/** The admin users list, newest first. `q` matches the id or name, and the email for the development team. */
export const adminUsersSearchSchema = Type.Object({
	q: Type.Optional(adminSearchTextSchema),
	...keysetSearch,
});

/** `pending_review` and `changes_requested`: the addon has an update submission in that status. */
export const adminAddonStatusSchema = Type.Enum([
	'listed',
	'delisted',
	'pending_review',
	'changes_requested',
]);

/** The admin addons list, by first approval. Every filter narrows; `q` matches the id or name. */
export const adminAddonsSearchSchema = Type.Object({
	q: Type.Optional(adminSearchTextSchema),
	type: Type.Optional(addonTypeSchema),
	status: Type.Optional(adminAddonStatusSchema),
	/** A user id: the addons they own or maintain. */
	maintainer: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
	/** The first day of first approval, inclusive, in UTC. */
	publishedFrom: Type.Optional(Type.String({ format: 'date' })),
	/** The last day of first approval, inclusive, in UTC. */
	publishedTo: Type.Optional(Type.String({ format: 'date' })),
	/** Defaults to `desc`, newest first. */
	order: Type.Optional(sortOrderSchema),
	...keysetSearch,
});

/** The human "why" a staff action records with its event. */
export const moderationReasonSchema = trimmedString(
	(value) => (value.length < 1 ? 'Give a reason.' : undefined),
	(value) => (value.length > 2000 ? 'Keep the reason under 2000 characters.' : undefined),
);

/** Makes `version` the one the addon serves; serving the pre-rollback version undoes a rollback. */
export const serveVersionRequestSchema = Type.Object({
	version: semverSchema,
	reason: moderationReasonSchema,
});

const editNameSchema = trimmedString(
	(value) => (value.length < 1 ? 'Give a name.' : undefined),
	(value) => (value.length > 100 ? 'Keep the name under 100 characters.' : undefined),
);

const editDescriptionSchema = trimmedString((value) =>
	value.length > 1000 ? 'Keep the description under 1000 characters.' : undefined,
);

/**
 * The whole desired state of an addon from the staff edit form. Each changed group needs its own
 * permission: metadata `addon:edit`, `delisted` `addon:delist`, `maintainers` `addon:transfer`.
 */
export const editAddonRequestSchema = Type.Object({
	/** The `revision` the form loaded; a mismatch is `edit_conflict`. */
	revision: Type.String({ minLength: 64, maxLength: 64 }),
	/** `null` unpins: the field follows the served version's manifest again. */
	name: Type.Union([editNameSchema, Type.Null()]),
	description: Type.Union([editDescriptionSchema, Type.Null()]),
	type: Type.Union([addonTypeSchema, Type.Null()]),
	repository: Type.Union([repositorySchema, Type.Null()]),
	/** The website icon, a Nucleo Micro Bold export name; `null` is the type's default. The server checks the name. */
	icon: Type.Union([Type.String({ minLength: 1, maxLength: 100 }), Type.Null()]),
	delisted: Type.Boolean(),
	maintainers: Type.Refine(
		Type.Refine(
			Type.Array(maintainerEntrySchema),
			(list) => new Set(list.map((member) => member.userId)).size === list.length,
			() => 'List each user once.',
		),
		(list) => list.some((member) => member.role === 'owner'),
		() => 'An addon needs an owner.',
	),
	reason: Type.Optional(moderationReasonSchema),
});

export const staffNoteBodySchema = trimmedString(
	(value) => (value.length < 1 ? 'Write a note.' : undefined),
	(value) => (value.length > 5000 ? 'Keep a note to 5000 characters.' : undefined),
);

export const staffNoteIdSchema = Type.Integer({ exclusiveMinimum: 0 });

/** A new note on one user or addon. */
export const createStaffNoteRequestSchema = Type.Object({
	subject: subjectSchema,
	body: staffNoteBodySchema,
});

/** Replaces the body of the caller's own note. */
export const editStaffNoteRequestSchema = Type.Object({
	id: staffNoteIdSchema,
	body: staffNoteBodySchema,
});

/** Deletes the caller's own note. */
export const deleteStaffNoteRequestSchema = Type.Object({ id: staffNoteIdSchema });

export type SubjectType = StaticDecode<typeof subjectTypeSchema>;
export type Subject = StaticDecode<typeof subjectSchema>;
export type MaintainerEntry = StaticDecode<typeof maintainerEntrySchema>;
export type PinnableField = StaticDecode<typeof pinnableFieldSchema>;
export type FieldChange = StaticDecode<typeof fieldChangeSchema>;
export type ModerationEventData = StaticDecode<typeof moderationEventDataSchema>;
export type ModerationEventKind = ModerationEventData['kind'];
export type ModerationEvent = StaticDecode<typeof moderationEventSchema>;
export type ModerationEventPage = StaticDecode<typeof moderationEventPageSchema>;
export type PageDirection = StaticDecode<typeof pageDirectionSchema>;
export type AdminUsersSearch = StaticDecode<typeof adminUsersSearchSchema>;
export type AdminAddonStatus = StaticDecode<typeof adminAddonStatusSchema>;
export type AdminAddonsSearch = StaticDecode<typeof adminAddonsSearchSchema>;
export type ServeVersionRequest = StaticDecode<typeof serveVersionRequestSchema>;
export type EditAddonRequest = StaticDecode<typeof editAddonRequestSchema>;
export type CreateStaffNoteRequest = StaticDecode<typeof createStaffNoteRequestSchema>;
export type EditStaffNoteRequest = StaticDecode<typeof editStaffNoteRequestSchema>;
export type DeleteStaffNoteRequest = StaticDecode<typeof deleteStaffNoteRequestSchema>;

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
