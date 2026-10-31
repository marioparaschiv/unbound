import {
	addonPathSchema,
	commitShaSchema,
	gitRefSchema,
	repositoryDetailsSchema,
	repositoryInputSchema,
	sourcePinSchema,
} from './source';
import { addonIdSchema, bytecodeDigestsSchema } from './manifest';
import { z } from './zod';

/** `listing` claims a new addon id; `update` publishes a new version of an addon the caller maintains. */
export const submissionKindSchema = z.enum(['listing', 'update']);

export const submissionStatusSchema = z.enum([
	'pending_review',
	'changes_requested',
	'approved',
	'rejected',
	'superseded',
	/** Closed unreviewed when uploads gave way to GitHub sources; no new submission gets it. */
	'expired',
	/** Closed without review because the author was banned. */
	'cancelled',
]);

/** Statuses that keep a submission in the queue: they hold a listing's addon id and count towards the pending caps. */
export const openSubmissionStatusSchema = z.enum([
	'pending_review',
	'changes_requested',
] satisfies SubmissionStatus[]);

/** The statuses a reviewer's decision moves a pending submission to. */
export const reviewDecisionSchema = z.enum([
	'approved',
	'rejected',
	'changes_requested',
] satisfies SubmissionStatus[]);

export const submissionReviewSchema = z.object({
	decision: reviewDecisionSchema,
	/** The rejection reason or requested changes; optional only on approval. */
	note: z.nullable(z.string()),
	reviewedAt: z.iso.datetime(),
});

export const submissionSchema = z.object({
	id: z.string().check(z.minLength(1)),
	addonId: addonIdSchema,
	version: z.string(),
	kind: submissionKindSchema,
	status: submissionStatusSchema,
	/** Where the submitted version was read from. */
	source: sourcePinSchema,
	/** The reviewer's decision, once one was made. */
	review: z.nullable(submissionReviewSchema),
});

export const MAX_CHANGELOG_LENGTH = 10_000;

/** The details an author may override; omitted fields keep what GitHub says. */
export const submissionDetailsOverridesSchema = z.object({
	homepage: z.optional(repositoryDetailsSchema.shape.homepage),
	tags: z.optional(repositoryDetailsSchema.shape.tags),
});

/**
 * One addon directory of a public repository at the commit the author previewed. The kind is derived
 * server-side; submitting again supersedes the caller's own submission with changes requested.
 */
export const createSubmissionRequestSchema = z.object({
	repository: repositoryInputSchema,
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; it must still resolve to `commitSha`. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	details: z.optional(submissionDetailsOverridesSchema),
});

export const createSubmissionResponseSchema = z.object({
	submission: submissionSchema,
});

/**
 * One first-party addon at a build commit of the first-party repository. Only CI's API key may send
 * it; the addon is published without review.
 */
export const publishFirstPartyRequestSchema = z.object({
	repository: repositoryInputSchema,
	path: addonPathSchema,
	/** The tag or branch holding the build commit; it must still resolve to `commitSha`. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
});

/** `unchanged` when that version was already published, so a re-run is a no-op. */
export const firstPartyPublishStatusSchema = z.enum(['published', 'replaced', 'unchanged']);

export const publishFirstPartyResponseSchema = z.object({
	status: firstPartyPublishStatusSchema,
	addonId: addonIdSchema,
	version: z.string(),
	/** The SHA-256 of the live bundle of that version. */
	sha256: z.string(),
});

/** One addon of the first-party repository, delisted or not, at its newest published version. */
export const firstPartyAddonSchema = z.object({
	id: addonIdSchema,
	/** The newest version ever published, rolled back or not, so it is never published again. */
	version: z.string(),
	/** The commit that version was read from, or `null` for a legacy upload. */
	commitSha: z.nullable(z.string()),
	/** The SHA-256 of that version's published bundle. */
	sha256: z.optional(z.string()),
	/** That version's `manifest.bytecode`, when it ships compiled bundles. */
	bytecode: z.optional(bytecodeDigestsSchema),
});

export const listFirstPartyAddonsResponseSchema = z.object({
	addons: z.array(firstPartyAddonSchema),
});

export type SubmissionKind = z.infer<typeof submissionKindSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type OpenSubmissionStatus = z.infer<typeof openSubmissionStatusSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type SubmissionReview = z.infer<typeof submissionReviewSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type SubmissionDetailsOverrides = z.infer<typeof submissionDetailsOverridesSchema>;
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;
export type PublishFirstPartyRequest = z.infer<typeof publishFirstPartyRequestSchema>;
export type FirstPartyPublishStatus = z.infer<typeof firstPartyPublishStatusSchema>;
export type PublishFirstPartyResponse = z.infer<typeof publishFirstPartyResponseSchema>;
export type FirstPartyAddon = z.infer<typeof firstPartyAddonSchema>;
export type ListFirstPartyAddonsResponse = z.infer<typeof listFirstPartyAddonsResponseSchema>;

export default {
	MAX_CHANGELOG_LENGTH,
	submissionKindSchema,
	submissionStatusSchema,
	openSubmissionStatusSchema,
	reviewDecisionSchema,
	submissionReviewSchema,
	submissionSchema,
	submissionDetailsOverridesSchema,
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
	publishFirstPartyRequestSchema,
	firstPartyPublishStatusSchema,
	publishFirstPartyResponseSchema,
	firstPartyAddonSchema,
	listFirstPartyAddonsResponseSchema,
};
