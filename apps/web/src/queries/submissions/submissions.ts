import {
	listRepositoryAddonsResponseSchema,
	pushableRepositoriesResponseSchema,
} from '@unbound-app/contracts/source';
import type {
	ListRepositoryAddonsQuery,
	ListRepositoryAddonsResponse,
} from '@unbound-app/contracts/source';
import { keepPreviousData, mutationOptions, queryOptions, skipToken } from '@tanstack/react-query';
import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';

import { createBrowserClient } from '~/lib/api/browser-client';
import { getSubmitOverview } from '~/lib/publishing';
import { invalidate } from '~/queries/invalidate';

/** The pinned addon directory a preview reads and a submission publishes. */
export type PreviewRequest = Omit<CreateSubmissionRequest, 'details'>;

/** Every submit-flow query key starts with this. */
export const submissionsKey = ['submissions'] as const;

/**
 * @description What `/submit` needs before the form renders.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`, resolving to whether GitHub is linked.
 */
export function submitOverviewQuery() {
	return queryOptions({
		queryKey: [...submissionsKey, 'overview'],
		queryFn: () => getSubmitOverview(),
	});
}

/**
 * @description The public repositories the linked GitHub account can push to, offered as shortcuts.
 * Browser only: the API client needs the page's origin.
 * @returns Options for `useQuery`.
 */
export function pushableRepositoriesQuery() {
	return queryOptions({
		queryKey: [...submissionsKey, 'repositories'],
		queryFn: () =>
			createBrowserClient()('GET /api/v1/github/repositories', {
				response: pushableRepositoriesResponseSchema,
			}),
	});
}

/**
 * @description The addons in a repository at a ref, read when the user asks; the last listing stays up
 * while the next one loads.
 * @param source The repository and ref to read, or `null` before the user picks one.
 * @returns Options for `useQuery` and `prefetchQuery`, resolving to the listing at the resolved commit.
 */
export function repositoryAddonsQuery(source: ListRepositoryAddonsQuery | null) {
	return queryOptions({
		queryKey: [...submissionsKey, 'listing', source],
		queryFn: source
			? () =>
					createBrowserClient()('GET /api/v1/github/addons', {
						query: source,
						response: listRepositoryAddonsResponseSchema,
					})
			: skipToken,
		placeholderData: keepPreviousData,
		// A branch moves, so the listing refreshes only when the user reads it again.
		staleTime: Infinity,
		retry: false,
	});
}

/**
 * @description Pins one addon of a listing to the listing's commit: the request a preview and a submission send.
 * @param listing The repository listing, or `undefined` before it loads.
 * @param path The addon directory in the listing.
 * @returns The pinned request, or `null` when the listing has no such addon or the addon has issues.
 */
export function toPreviewRequest(
	listing: ListRepositoryAddonsResponse | undefined,
	path: string | null,
): PreviewRequest | null {
	const addon = listing?.addons.find((entry) => entry.path === path);

	if (!listing || !addon || addon.issues.length > 0) return null;

	return {
		repository: listing.repository,
		path: addon.path,
		ref: listing.ref,
		commitSha: listing.commitSha,
	};
}

/**
 * @description What submitting an addon directory at a commit would publish.
 * @param request The pinned addon directory, or `null` before the user picks one.
 * @returns Options for `useQuery` and `prefetchQuery`, resolving to the preview.
 */
export function submissionPreviewQuery(request: PreviewRequest | null) {
	return queryOptions({
		queryKey: [...submissionsKey, 'preview', request],
		queryFn: request
			? async () => {
					const { preview } = await createBrowserClient()(
						'POST /api/v1/submissions/preview',
						{ body: request, response: submissionPreviewResponseSchema },
					);

					return preview;
				}
			: skipToken,
		// Pinned to a commit, so the preview never goes stale.
		staleTime: Infinity,
		retry: false,
	});
}

/**
 * @description Submits an addon for review, then refreshes the dashboard and the review queue.
 * @returns Options for `useMutation`, taking the submission request.
 */
export function createSubmissionMutation() {
	return mutationOptions({
		mutationFn: async (request: CreateSubmissionRequest) => {
			const { submission } = await createBrowserClient()('POST /api/v1/submissions', {
				body: request,
				response: createSubmissionResponseSchema,
			});

			return submission;
		},
		onSuccess: (_submission, _request, _result, context) =>
			invalidate(context.client, 'submission'),
	});
}

export default {
	submissionsKey,
	submitOverviewQuery,
	pushableRepositoriesQuery,
	repositoryAddonsQuery,
	toPreviewRequest,
	submissionPreviewQuery,
	createSubmissionMutation,
};
