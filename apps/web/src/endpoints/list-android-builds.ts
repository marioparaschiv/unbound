import {
	androidBuildsQuerySchema,
	androidBuildsResponseSchema,
} from '@unbound-app/contracts/android-builds';
import { Type } from '@unbound-app/contracts/schema';

import { listAndroidBuilds } from '~/lib/android-builds';
import endpoint from '~/lib/api/endpoint';

const listAndroidBuildsEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: androidBuildsQuerySchema,
		response: androidBuildsResponseSchema,
	},
	({ ctx, query }) => listAndroidBuilds(ctx, query),
	{ rateLimit: { bucket: 'android-builds', budget: 'UPDATES' } },
);

export default listAndroidBuildsEndpoint;
