import {
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { createSubmission } from '~/lib/submissions';
import { callerEndpoint } from '~/lib/api/endpoint';

const createSubmissionEndpoint = callerEndpoint(
	{
		body: createSubmissionRequestSchema,
		query: z.undefined(),
		response: createSubmissionResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return createSubmission(ctx, caller, body);
	},
);

export default createSubmissionEndpoint;
