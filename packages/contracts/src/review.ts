import type { reviewDecisionSchema } from './publish';

import { submissionKindSchema, submissionSchema } from './publish';
import { addonVersionSchema, sha256Schema } from './addons';
import { addonManifestSchema } from './manifest';
import { userSummarySchema } from './account';
import { z } from './zod';

const noteSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(10_000));

export const reviewQueueQuerySchema = z.optional(
	z.object({
		kind: z.optional(submissionKindSchema),
	}),
);

export const reviewQueueItemSchema = z.object({
	submission: submissionSchema,
	manifest: addonManifestSchema,
	changelog: z.nullable(z.string()),
	bundleSize: z.int().check(z.positive()),
	sha256: sha256Schema,
	submittedAt: z.iso.datetime(),
	submitter: userSummarySchema,
	/** The viewer authored it or maintains the addon, so the server refuses their review with `self_review`. */
	selfReview: z.boolean(),
	/** The addon's newest approved version, for updates. */
	previousVersion: z.nullable(addonVersionSchema),
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
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;
export type ReviewSubmissionResponse = z.infer<typeof reviewSubmissionResponseSchema>;

export default {
	reviewQueueQuerySchema,
	reviewQueueItemSchema,
	reviewQueueResponseSchema,
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
};
