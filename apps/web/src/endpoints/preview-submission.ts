import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import { Type } from '@unbound-app/contracts/schema';

import { previewSubmission } from '~/lib/submissions';
import { callerEndpoint } from '~/lib/api/endpoint';

const previewSubmissionEndpoint = callerEndpoint(
	{
		body: createSubmissionRequestSchema,
		query: Type.Undefined(),
		response: submissionPreviewResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return previewSubmission(ctx, caller, body);
	},
);

export default previewSubmissionEndpoint;
