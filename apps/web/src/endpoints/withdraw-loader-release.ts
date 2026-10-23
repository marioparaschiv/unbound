import { loaderPlatformSchema, loaderReleaseSchema } from '@unbound-app/contracts/loader';
import { semverSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

import { withdrawLoaderRelease } from '~/lib/loader-releases';
import endpoint, { parseParam } from '~/lib/api/endpoint';
import { requireCaller } from '~/lib/api/caller';

const withdrawLoaderReleaseEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: loaderReleaseSchema },
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		return withdrawLoaderRelease(
			ctx,
			caller,
			parseParam(params, 'platform', loaderPlatformSchema),
			parseParam(params, 'version', semverSchema),
		);
	},
);

export default withdrawLoaderReleaseEndpoint;
