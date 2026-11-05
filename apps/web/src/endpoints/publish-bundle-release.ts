import {
	bundleReleaseSchema,
	publishBundleReleaseRequestSchema,
} from '@unbound-app/contracts/loader';
import { Type } from '@unbound-app/contracts/schema';

import { publishBundleRelease } from '~/lib/bundle-releases';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishBundleReleaseEndpoint = callerEndpoint(
	{
		body: publishBundleReleaseRequestSchema,
		query: Type.Undefined(),
		response: bundleReleaseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishBundleRelease(ctx, caller, body);
	},
);

export default publishBundleReleaseEndpoint;
