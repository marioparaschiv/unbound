import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { previewSubmission } from '~/lib/submissions';
import { callerEndpoint } from '~/lib/api/endpoint';

const previewSubmissionEndpoint = callerEndpoint(
	{
		body: createSubmissionRequestSchema,
		query: z.undefined(),
		response: submissionPreviewResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return previewSubmission(ctx, caller, body);
	},
);

export default previewSubmissionEndpoint;
