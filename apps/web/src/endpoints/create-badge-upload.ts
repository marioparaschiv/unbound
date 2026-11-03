import {
	createBadgeUploadRequestSchema,
	presignedBadgeUploadSchema,
} from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import { createBadgeUpload } from '~/lib/sponsors/badges';
import { callerEndpoint } from '~/lib/api/endpoint';

const createBadgeUploadEndpoint = callerEndpoint(
	{
		body: createBadgeUploadRequestSchema,
		query: Type.Undefined(),
		response: presignedBadgeUploadSchema,
	},
	async ({ ctx, body, caller }) => {
		return createBadgeUpload(ctx, caller.user.id, body.size);
	},
);

export default createBadgeUploadEndpoint;
