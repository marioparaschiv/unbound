import {
	loaderReleaseSchema,
	publishLoaderReleaseRequestSchema,
} from '@unbound-app/contracts/loader';
import { z } from 'zod';

import { publishLoaderRelease } from '~/lib/loader-releases';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const publishLoaderReleaseEndpoint = endpoint(
	{
		body: publishLoaderReleaseRequestSchema,
		query: z.undefined(),
		response: loaderReleaseSchema,
	},
	async ({ ctx, request, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return publishLoaderRelease(ctx, caller, body);
	},
);

export default publishLoaderReleaseEndpoint;
