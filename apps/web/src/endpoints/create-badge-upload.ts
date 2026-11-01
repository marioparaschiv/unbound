import {
	createBadgeUploadRequestSchema,
	presignedBadgeUploadSchema,
} from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { createBadgeUpload } from '~/lib/sponsors/badges';
import { callerEndpoint } from '~/lib/api/endpoint';

const createBadgeUploadEndpoint = callerEndpoint(
	{
		body: createBadgeUploadRequestSchema,
		query: z.undefined(),
		response: presignedBadgeUploadSchema,
	},
	async ({ ctx, body, caller }) => {
		return createBadgeUpload(ctx, caller.user.id, body.size);
	},
);

export default createBadgeUploadEndpoint;
