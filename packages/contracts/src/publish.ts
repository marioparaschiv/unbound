import {
	addonPathSchema,
	commitShaSchema,
	gitRefSchema,
	repositoryInputSchema,
	sourcePinSchema,
} from './source';
import { addonIdSchema, bytecodeDigestsSchema } from './manifest';
import { submissionTagsSchema } from './tags';
import { Type, type Static } from './schema';
import { addonIconSchema } from './icons';

/** `listing` claims a new addon id; `update` publishes a new version of an addon the caller maintains. */
export const submissionKindSchema = Type.Enum(['listing', 'update']);

export const submissionStatusSchema = Type.Enum([
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
export const OPEN_SUBMISSION_STATUSES = [
	'pending_review',
	'changes_requested',
] as const satisfies readonly SubmissionStatus[];

export const openSubmissionStatusSchema = Type.Enum(OPEN_SUBMISSION_STATUSES);

/** The statuses a reviewer's decision moves a pending submission to. */
export const REVIEW_DECISIONS = [
	'approved',
	'rejected',
	'changes_requested',
] as const satisfies readonly SubmissionStatus[];

export const reviewDecisionSchema = Type.Enum(REVIEW_DECISIONS);

export const submissionReviewSchema = Type.Object({
	decision: reviewDecisionSchema,
	/** The rejection reason or requested changes; optional only on approval. */
	note: Type.Union([Type.String(), Type.Null()]),
	reviewedAt: Type.String({ format: 'date-time' }),
});

export const submissionSchema = Type.Object({
	id: Type.String({ minLength: 1 }),
	addonId: addonIdSchema,
	version: Type.String(),
	kind: submissionKindSchema,
	status: submissionStatusSchema,
	/** Where the submitted version was read from. */
	source: sourcePinSchema,
	/** The reviewer's decision, once one was made. */
	review: Type.Union([submissionReviewSchema, Type.Null()]),
});

export const MAX_CHANGELOG_LENGTH = 10_000;

/** How many maintainers besides its owners one submission may give an addon. */
export const MAX_SUBMISSION_MAINTAINERS = 20;

/** The users an owner makes an addon's maintainers, by user id. */
export const submissionMaintainersSchema = Type.Refine(
	Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
		maxItems: MAX_SUBMISSION_MAINTAINERS,
	}),
	(ids) => new Set(ids).size === ids.length,
	() => 'User ids must be unique.',
);

/** What the author chose for the listing; an omitted field keeps what the addon has. */
export const submissionDetailsSchema = Type.Object({
	/** Replaces the addon's tags on approval; `[]` clears them. */
	tags: Type.Optional(submissionTagsSchema),
	/** Replaces the addon's maintainers other than its owners on approval; `[]` removes them. Owners only. */
	maintainers: Type.Optional(submissionMaintainersSchema),
	/** The website icon a new listing starts with; updates change it from the dashboard. */
	icon: Type.Optional(addonIconSchema),
});

/**
 * One addon directory of a public repository at the commit the author previewed. The kind is derived
 * server-side; submitting again supersedes the caller's own submission with changes requested.
 */
export const createSubmissionRequestSchema = Type.Object({
	repository: repositoryInputSchema,
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; it must still resolve to `commitSha`. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	details: Type.Optional(submissionDetailsSchema),
});

export const createSubmissionResponseSchema = Type.Object({
	submission: submissionSchema,
});

/**
 * One first-party addon at a build commit of the first-party repository. Only CI's API key may send
 * it; the addon is published without review.
 */
export const publishFirstPartyRequestSchema = Type.Object({
	repository: repositoryInputSchema,
	path: addonPathSchema,
	/** The tag or branch holding the build commit; it must still resolve to `commitSha`. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
});

/** `unchanged` when that version was already published, so a re-run is a no-op. */
export const firstPartyPublishStatusSchema = Type.Enum(['published', 'replaced', 'unchanged']);

export const publishFirstPartyResponseSchema = Type.Object({
	status: firstPartyPublishStatusSchema,
	addonId: addonIdSchema,
	version: Type.String(),
	/** The SHA-256 of the live bundle of that version. */
	sha256: Type.String(),
});

/** One addon of the first-party repository, delisted or not, at its newest published version. */
export const firstPartyAddonSchema = Type.Object({
	id: addonIdSchema,
	/** The newest version ever published, rolled back or not, so it is never published again. */
	version: Type.String(),
	/** The commit that version was read from, or `null` for a legacy upload. */
	commitSha: Type.Union([Type.String(), Type.Null()]),
	/** The SHA-256 of that version's published bundle. */
	sha256: Type.Optional(Type.String()),
	/** That version's `manifest.bytecode`, when it ships compiled bundles. */
	bytecode: Type.Optional(bytecodeDigestsSchema),
});

export const listFirstPartyAddonsResponseSchema = Type.Object({
	addons: Type.Array(firstPartyAddonSchema),
});

export type SubmissionKind = Static<typeof submissionKindSchema>;
export type SubmissionStatus = Static<typeof submissionStatusSchema>;
export type OpenSubmissionStatus = Static<typeof openSubmissionStatusSchema>;
export type ReviewDecision = Static<typeof reviewDecisionSchema>;
export type SubmissionReview = Static<typeof submissionReviewSchema>;
export type Submission = Static<typeof submissionSchema>;
export type SubmissionDetails = Static<typeof submissionDetailsSchema>;
export type CreateSubmissionRequest = Static<typeof createSubmissionRequestSchema>;
export type CreateSubmissionResponse = Static<typeof createSubmissionResponseSchema>;
export type PublishFirstPartyRequest = Static<typeof publishFirstPartyRequestSchema>;
export type FirstPartyPublishStatus = Static<typeof firstPartyPublishStatusSchema>;
export type PublishFirstPartyResponse = Static<typeof publishFirstPartyResponseSchema>;
export type FirstPartyAddon = Static<typeof firstPartyAddonSchema>;
export type ListFirstPartyAddonsResponse = Static<typeof listFirstPartyAddonsResponseSchema>;

export default {
	MAX_CHANGELOG_LENGTH,
	OPEN_SUBMISSION_STATUSES,
	REVIEW_DECISIONS,
	MAX_SUBMISSION_MAINTAINERS,
	submissionMaintainersSchema,
	submissionKindSchema,
	submissionStatusSchema,
	openSubmissionStatusSchema,
	reviewDecisionSchema,
	submissionReviewSchema,
	submissionSchema,
	submissionDetailsSchema,
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
	publishFirstPartyRequestSchema,
	firstPartyPublishStatusSchema,
	publishFirstPartyResponseSchema,
	firstPartyAddonSchema,
	listFirstPartyAddonsResponseSchema,
};
