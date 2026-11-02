import {
	loaderReleaseSchema,
	publishLoaderReleaseRequestSchema,
} from '@unbound-app/contracts/loader';
import { Type } from '@unbound-app/contracts/schema';

import { publishLoaderRelease } from '~/lib/loader-releases';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishLoaderReleaseEndpoint = callerEndpoint(
	{
		body: publishLoaderReleaseRequestSchema,
		query: Type.Undefined(),
		response: loaderReleaseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishLoaderRelease(ctx, caller, body);
	},
);

export default publishLoaderReleaseEndpoint;
