import { reviewQueueQuerySchema, reviewQueueResponseSchema } from '@unbound-app/contracts/review';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { listReviewQueue } from '~/lib/review';

const reviewQueueEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: reviewQueueQuerySchema, response: reviewQueueResponseSchema },
	async ({ ctx, query, caller }) => {
		return listReviewQueue(ctx, caller, query?.kind);
	},
);

export default reviewQueueEndpoint;
