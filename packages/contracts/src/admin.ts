import { reviewDecisionSchema, submissionKindSchema } from './publish';
import { maintainerRoleSchema } from './addons';
import { userSummarySchema } from './account';
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
};
