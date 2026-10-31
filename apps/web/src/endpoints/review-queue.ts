import { reviewQueueQuerySchema, reviewQueueResponseSchema } from '@unbound-app/contracts/review';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { listReviewQueue } from '~/lib/review';

const reviewQueueEndpoint = callerEndpoint(
	{ body: z.undefined(), query: reviewQueueQuerySchema, response: reviewQueueResponseSchema },
	async ({ ctx, query, caller }) => {
		return listReviewQueue(ctx, caller, query?.kind);
	},
);

export default reviewQueueEndpoint;
