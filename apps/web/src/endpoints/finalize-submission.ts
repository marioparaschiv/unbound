import {
	finalizeSubmissionRequestSchema,
	finalizeSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { finalizeSubmission } from '~/lib/submissions';
import { requireCaller } from '~/lib/api/caller';

const finalizeSubmissionEndpoint = endpoint(
	{
		body: z.optional(finalizeSubmissionRequestSchema),
		query: z.undefined(),
		response: finalizeSubmissionResponseSchema,
	},
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		return finalizeSubmission(ctx, caller, requireParam(params, 'id'));
	},
);

export default finalizeSubmissionEndpoint;
