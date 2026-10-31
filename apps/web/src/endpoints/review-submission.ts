import {
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
} from '@unbound-app/contracts/review';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { reviewSubmission } from '~/lib/review';

const reviewSubmissionEndpoint = callerEndpoint(
	{
		body: reviewSubmissionRequestSchema,
		query: z.undefined(),
		response: reviewSubmissionResponseSchema,
	},
	async ({ ctx, params, body, caller }) => {
		return reviewSubmission(ctx, caller, requireParam(params, 'id'), body);
	},
);

export default reviewSubmissionEndpoint;
