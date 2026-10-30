import { loaderPlatformSchema, loaderReleaseSchema } from '@unbound-app/contracts/loader';
import { semverSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

import { callerEndpoint, parseParam } from '~/lib/api/endpoint';
import { withdrawLoaderRelease } from '~/lib/loader-releases';

const withdrawLoaderReleaseEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: loaderReleaseSchema },
	async ({ ctx, params, caller }) => {
		return withdrawLoaderRelease(
			ctx,
			caller,
			parseParam(params, 'platform', loaderPlatformSchema),
			parseParam(params, 'version', semverSchema),
		);
	},
);

export default withdrawLoaderReleaseEndpoint;
