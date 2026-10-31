import type { ReviewQueueQuery, ReviewSubmissionRequest } from '@unbound-app/contracts/review';
import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query';
import { reviewSubmissionResponseSchema } from '@unbound-app/contracts/review';

import { createBrowserClient } from '~/lib/api/browser-client';
import { fetchReviewQueue } from '~/lib/review-functions';
import { invalidate } from '~/queries/invalidate';
import { reviewKey } from '~/queries/keys';

/**
 * @description The `/review` queue for a kind filter; switching the filter keeps the old list up until it loads.
 * @param query The kind filter from the URL.
 * @returns Options for `useQuery` and `ensureQueryData`.
 */
export function reviewQueueQuery(query: ReviewQueueQuery) {
	return queryOptions({
		queryKey: [...reviewKey, 'queue', query],
		queryFn: () => fetchReviewQueue({ data: query }),
		placeholderData: keepPreviousData,
		// Only a queue with nothing to show goes to the error boundary; a failed refetch keeps the old one.
		throwOnError: (_error, cached) => cached.state.data === undefined,
	});
}

/**
 * @description Approves, rejects or requests changes on a submission, then refreshes the queue, the
 * dashboard and, on approval, the marketplace.
 * @param submissionId The submission id.
 * @returns Options for `useMutation`, taking the decision and its note.
 */
export function reviewDecisionMutation(submissionId: string) {
	return mutationOptions({
		mutationFn: (body: ReviewSubmissionRequest) =>
			createBrowserClient()('POST /api/v1/submissions/$id/review', {
				params: { id: submissionId },
				body,
				response: reviewSubmissionResponseSchema,
			}),
		onSuccess: (_response, body, _result, context) =>
			body.decision === 'approved'
				? invalidate(context.client, 'review', 'release')
				: invalidate(context.client, 'review'),
	});
}

export default { reviewQueueQuery, reviewDecisionMutation };
