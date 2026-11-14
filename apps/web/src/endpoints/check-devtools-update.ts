import {
	devtoolsUpdateQuerySchema,
	devtoolsUpdateResponseSchema,
} from '@unbound-app/contracts/devtools';
import { Type } from '@unbound-app/contracts/schema';

import { findDevtoolsUpdate } from '~/lib/devtools-releases';
import endpoint from '~/lib/api/endpoint';

const checkDevtoolsUpdateEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: devtoolsUpdateQuerySchema,
		response: devtoolsUpdateResponseSchema,
	},
	({ ctx, query }) => findDevtoolsUpdate(ctx, query),
	{ rateLimit: { bucket: 'devtools-updates', budget: 'UPDATES' } },
);

export default checkDevtoolsUpdateEndpoint;
