import { uploadBadgeImageResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { callerEndpoint, parseParam } from '~/lib/api/endpoint';
import { completeBadgeUpload } from '~/lib/sponsors/badges';

const completeBadgeUploadEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: uploadBadgeImageResponseSchema },
	async ({ ctx, params, caller }) => {
		return completeBadgeUpload(ctx, caller.user.id, parseParam(params, 'uploadId', z.uuid()));
	},
);

export default completeBadgeUploadEndpoint;
