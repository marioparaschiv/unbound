import { loaderPlatformSchema, loaderReleaseSchema } from '@unbound-app/contracts/loader';
import { semverSchema } from '@unbound-app/contracts/manifest';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, parseParam } from '~/lib/api/endpoint';
import { withdrawLoaderRelease } from '~/lib/loader-releases';

const withdrawLoaderReleaseEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: loaderReleaseSchema },
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
