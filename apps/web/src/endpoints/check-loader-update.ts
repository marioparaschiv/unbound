import { loaderUpdateQuerySchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import { Type } from '@unbound-app/contracts/schema';

import { findLoaderUpdate } from '~/lib/loader-releases';
import endpoint from '~/lib/api/endpoint';

const checkLoaderUpdateEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: loaderUpdateQuerySchema,
		response: loaderUpdateResponseSchema,
	},
	({ ctx, query }) => findLoaderUpdate(ctx, query),
	{ rateLimit: { bucket: 'loader-updates', budget: 'UPDATES' } },
);

export default checkLoaderUpdateEndpoint;
