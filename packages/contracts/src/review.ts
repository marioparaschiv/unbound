import type { reviewDecisionSchema } from './publish';

import { repositoryDetailsSchema, sourcePinSchema } from './source';
import { submissionKindSchema, submissionSchema } from './publish';
import { addonVersionSchema, sha256Schema } from './addons';
import { addonManifestSchema } from './manifest';
import { userSummarySchema } from './account';
import { changelogSchema } from './changelog';
import { withoutNul } from './text';
import { z } from './zod';

const noteSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(10_000), withoutNul);

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

export const reviewQueueItemSchema = z.extend(submissionContentSchema, {
	submission: submissionSchema,
	source: sourcePinSchema,
	submittedAt: z.iso.datetime(),
	submitter: userSummarySchema,
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
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type SubmissionPreview = z.infer<typeof submissionPreviewSchema>;
export type SubmissionPreviewResponse = z.infer<typeof submissionPreviewResponseSchema>;
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;
export type ReviewSubmissionResponse = z.infer<typeof reviewSubmissionResponseSchema>;

export default {
	reviewQueueQuerySchema,
	submissionContentSchema,
	reviewQueueItemSchema,
	reviewQueueResponseSchema,
	submissionPreviewSchema,
	submissionPreviewResponseSchema,
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
};
