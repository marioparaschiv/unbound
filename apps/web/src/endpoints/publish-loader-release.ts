import {
	loaderReleaseSchema,
	publishLoaderReleaseRequestSchema,
} from '@unbound-app/contracts/loader';
import { z } from 'zod';

import { publishLoaderRelease } from '~/lib/loader-releases';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishLoaderReleaseEndpoint = callerEndpoint(
	{
		body: publishLoaderReleaseRequestSchema,
		query: z.undefined(),
		response: loaderReleaseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishLoaderRelease(ctx, caller, body);
	},
);

export default publishLoaderReleaseEndpoint;
