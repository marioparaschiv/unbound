import { reviewQueueQuerySchema } from '@unbound-app/contracts/review';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import type { ReviewEntry } from '~/lib/review-entry';
import { toReviewEntry } from '~/lib/review-entry';
import { requireCaller } from '~/lib/api/caller';
import { listReviewQueue } from '~/lib/review';
import app from '~/lib/app';

/**
 * @description Loads the review queue for `/review`, optionally narrowed to one submission kind.
 * @returns The waiting submissions, oldest first.
 */
export const fetchReviewQueue = createServerFn({ method: 'GET' })
	.validator(reviewQueueQuerySchema)
	.handler(async ({ data }): Promise<ReviewEntry[]> => {
		const caller = await requireCaller(app, getRequestHeaders());
		const { submissions } = await listReviewQueue(app, caller, data?.kind);

		return submissions.map(toReviewEntry);
	});

export default { fetchReviewQueue };
