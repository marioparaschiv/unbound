import { uploadBadgeImageResponseSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, parseParam } from '~/lib/api/endpoint';
import { completeBadgeUpload } from '~/lib/sponsors/badges';

const completeBadgeUploadEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: uploadBadgeImageResponseSchema },
	async ({ ctx, params, caller }) => {
		return completeBadgeUpload(
			ctx,
			caller.user.id,
			parseParam(params, 'uploadId', Type.String({ format: 'uuid' })),
		);
	},
);

export default completeBadgeUploadEndpoint;
