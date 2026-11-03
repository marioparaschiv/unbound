import {
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import { Type } from '@unbound-app/contracts/schema';

import { createSubmission } from '~/lib/submissions';
import { callerEndpoint } from '~/lib/api/endpoint';

const createSubmissionEndpoint = callerEndpoint(
	{
		body: createSubmissionRequestSchema,
		query: Type.Undefined(),
		response: createSubmissionResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return createSubmission(ctx, caller, body);
	},
);

export default createSubmissionEndpoint;
