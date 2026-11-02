import type { reviewDecisionSchema } from './publish';

import { trimmedString, Type, type Static, type StaticDecode } from './schema';
import { repositoryDetailsSchema, sourcePinSchema } from './source';
import { submissionKindSchema, submissionSchema } from './publish';
import { addonVersionSchema, sha256Schema } from './addons';
import { addonManifestSchema } from './manifest';
import { tagIdSchema, tagSchema } from './tags';
import { addonPageSchema } from './addon-page';
import { userSummarySchema } from './account';
import { changelogSchema } from './changelog';
import { addonIconSchema } from './icons';

const NOTE_MAX_LENGTH = 10_000;

const noteSchema = trimmedString(
	(value) => (value.length < 1 ? 'Too small: expected string to have >=1 characters' : undefined),
	(value) =>
		value.length > NOTE_MAX_LENGTH
			? `Too big: expected string to have <=${NOTE_MAX_LENGTH} characters`
			: undefined,
);

export const reviewQueueQuerySchema = Type.Optional(
	Type.Object({
		kind: Type.Optional(submissionKindSchema),
	}),
);

/** What a submission read from its source: what the reviewer sees and approval publishes. */
export const submissionContentSchema = Type.Object({
	/** `main` names the published bundle. */
	manifest: addonManifestSchema,
	bundleSize: Type.Integer({ exclusiveMinimum: 0 }),
	sha256: sha256Schema,
	addonMd: Type.Union([Type.String(), Type.Null()]),
	/** The measured `{output}/page.json`, its media checked against the commit; `null` when none is committed. */
	page: Type.Union([addonPageSchema, Type.Null()]),
	/** The entry for `manifest.version`, or `null` when the addon has no CHANGELOG.md. */
	changelog: Type.Union([changelogSchema, Type.Null()]),
	details: repositoryDetailsSchema,
});

/** How approving a submission changes the addon's maintainers other than its owners. */
export const maintainerChangeSchema = Type.Object({
	added: Type.Array(userSummarySchema),
	removed: Type.Array(userSummarySchema),
});

export const reviewQueueItemSchema = Type.Object({
	...submissionContentSchema.properties,
	submission: submissionSchema,
	source: sourcePinSchema,
	submittedAt: Type.String({ format: 'date-time' }),
	submitter: userSummarySchema,
	/** The tags approval gives the addon, in menu order, or `null` to keep its current ones. */
	tags: Type.Union([Type.Array(tagSchema), Type.Null()]),
	/** The maintainers approval adds and removes, or `null` to keep the current ones. */
	maintainers: Type.Union([maintainerChangeSchema, Type.Null()]),
	/** The website icon a new listing starts with, or `null` for the type's default. */
	icon: Type.Union([addonIconSchema, Type.Null()]),
	/** The viewer authored it or maintains the addon, so the server refuses their review with `self_review`. */
	selfReview: Type.Boolean(),
	/** The addon's newest approved version, for updates. */
	previousVersion: Type.Union([addonVersionSchema, Type.Null()]),
	/** The previous version's ADDON.md; `null` for new listings and versions without one. */
	previousAddonMd: Type.Union([Type.String(), Type.Null()]),
	/** A short-lived presigned download of the staged bundle. */
	artifact: Type.Object({
		url: Type.String({ format: 'url' }),
		expiresAt: Type.String({ format: 'date-time' }),
	}),
});

/** Submissions pending review, oldest first. */
export const reviewQueueResponseSchema = Type.Object({
	submissions: Type.Array(reviewQueueItemSchema),
});

/** What submitting the same request would create, without creating it. */
export const submissionPreviewSchema = Type.Object({
	...submissionContentSchema.properties,
	kind: submissionKindSchema,
	source: sourcePinSchema,
	/** The tags to preselect: an update's current tags, or a new listing's repository topics that are tag ids. */
	suggestedTags: Type.Array(tagIdSchema),
	/** The addon's maintainers other than its owners: an update's current ones, none for a new listing. */
	suggestedMaintainers: Type.Array(userSummarySchema),
	/** Whether the author may change them: they own the addon, or the new listing makes them its owner. */
	canEditMaintainers: Type.Boolean(),
});

export const submissionPreviewResponseSchema = Type.Object({
	preview: submissionPreviewSchema,
});

export const reviewSubmissionRequestSchema = Type.Union([
	Type.Object({
		decision: Type.Enum(['approved'] as const satisfies readonly Static<
			typeof reviewDecisionSchema
		>[]),
		note: Type.Optional(noteSchema),
	}),
	Type.Object({
		decision: Type.Enum(['rejected', 'changes_requested'] as const satisfies readonly Static<
			typeof reviewDecisionSchema
		>[]),
		/** The rejection reason or the changes the author must make. */
		note: noteSchema,
	}),
]);

export const reviewSubmissionResponseSchema = Type.Object({
	submission: submissionSchema,
});

export type ReviewQueueQuery = StaticDecode<typeof reviewQueueQuerySchema>;
export type SubmissionContent = StaticDecode<typeof submissionContentSchema>;
export type MaintainerChange = StaticDecode<typeof maintainerChangeSchema>;
export type ReviewQueueItem = StaticDecode<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = StaticDecode<typeof reviewQueueResponseSchema>;
export type SubmissionPreview = StaticDecode<typeof submissionPreviewSchema>;
export type SubmissionPreviewResponse = StaticDecode<typeof submissionPreviewResponseSchema>;
export type ReviewSubmissionRequest = StaticDecode<typeof reviewSubmissionRequestSchema>;
export type ReviewSubmissionResponse = StaticDecode<typeof reviewSubmissionResponseSchema>;

export default {
	reviewQueueQuerySchema,
	submissionContentSchema,
	maintainerChangeSchema,
	reviewQueueItemSchema,
	reviewQueueResponseSchema,
	submissionPreviewSchema,
	submissionPreviewResponseSchema,
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
};
