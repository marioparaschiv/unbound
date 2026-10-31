import type { reviewDecisionSchema } from './publish';

import { repositoryDetailsSchema, sourcePinSchema } from './source';
import { submissionKindSchema, submissionSchema } from './publish';
import { addonVersionSchema, sha256Schema } from './addons';
import { tagIdSchema, tagSchema } from './tags';
import { addonIconSchema } from './icons';
import { addonManifestSchema } from './manifest';
import { userSummarySchema } from './account';
import { changelogSchema } from './changelog';
import { z } from './zod';

const noteSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(10_000));

export const reviewQueueQuerySchema = z.optional(
	z.object({
		kind: z.optional(submissionKindSchema),
	}),
);

/** What a submission read from its source: what the reviewer sees and approval publishes. */
export const submissionContentSchema = z.object({
	/** `main` names the published bundle. */
	manifest: addonManifestSchema,
	bundleSize: z.int().check(z.positive()),
	sha256: sha256Schema,
	addonMd: z.nullable(z.string()),
	/** The entry for `manifest.version`, or `null` when the addon has no CHANGELOG.md. */
	changelog: z.nullable(changelogSchema),
	details: repositoryDetailsSchema,
});

/** How approving a submission changes the addon's maintainers other than its owners. */
export const maintainerChangeSchema = z.object({
	added: z.array(userSummarySchema),
	removed: z.array(userSummarySchema),
});

export const reviewQueueItemSchema = z.extend(submissionContentSchema, {
	submission: submissionSchema,
	source: sourcePinSchema,
	submittedAt: z.iso.datetime(),
	submitter: userSummarySchema,
	/** The tags approval gives the addon, in menu order, or `null` to keep its current ones. */
	tags: z.nullable(z.array(tagSchema)),
	/** The maintainers approval adds and removes, or `null` to keep the current ones. */
	maintainers: z.nullable(maintainerChangeSchema),
	/** The website icon a new listing starts with, or `null` for the type's default. */
	icon: z.nullable(addonIconSchema),
	/** The viewer authored it or maintains the addon, so the server refuses their review with `self_review`. */
	selfReview: z.boolean(),
	/** The addon's newest approved version, for updates. */
	previousVersion: z.nullable(addonVersionSchema),
	/** The previous version's ADDON.md; `null` for new listings and versions without one. */
	previousAddonMd: z.nullable(z.string()),
	/** A short-lived presigned download of the staged bundle. */
	artifact: z.object({
		url: z.url(),
		expiresAt: z.iso.datetime(),
	}),
});

/** Submissions pending review, oldest first. */
export const reviewQueueResponseSchema = z.object({
	submissions: z.array(reviewQueueItemSchema),
});

/** What submitting the same request would create, without creating it. */
export const submissionPreviewSchema = z.extend(submissionContentSchema, {
	kind: submissionKindSchema,
	source: sourcePinSchema,
	/** The tags to preselect: an update's current tags, or a new listing's repository topics that are tag ids. */
	suggestedTags: z.array(tagIdSchema),
	/** The addon's maintainers other than its owners: an update's current ones, none for a new listing. */
	suggestedMaintainers: z.array(userSummarySchema),
	/** Whether the author may change them: they own the addon, or the new listing makes them its owner. */
	canEditMaintainers: z.boolean(),
});

export const submissionPreviewResponseSchema = z.object({
	preview: submissionPreviewSchema,
});

export const reviewSubmissionRequestSchema = z.discriminatedUnion('decision', [
	z.object({
		decision: z.enum(['approved'] satisfies z.infer<typeof reviewDecisionSchema>[]),
		note: z.optional(noteSchema),
	}),
	z.object({
		decision: z.enum(['rejected', 'changes_requested'] satisfies z.infer<
			typeof reviewDecisionSchema
		>[]),
		/** The rejection reason or the changes the author must make. */
		note: noteSchema,
	}),
]);

export const reviewSubmissionResponseSchema = z.object({
	submission: submissionSchema,
});

export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;
export type SubmissionContent = z.infer<typeof submissionContentSchema>;
export type MaintainerChange = z.infer<typeof maintainerChangeSchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type SubmissionPreview = z.infer<typeof submissionPreviewSchema>;
export type SubmissionPreviewResponse = z.infer<typeof submissionPreviewResponseSchema>;
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;
export type ReviewSubmissionResponse = z.infer<typeof reviewSubmissionResponseSchema>;

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
