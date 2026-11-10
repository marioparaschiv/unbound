import { updatesRequestSchema, updatesResponseSchema } from '@unbound-app/contracts/updates';
import { Type } from '@unbound-app/contracts/schema';

import { findUpdates } from '~/lib/updates';
import endpoint from '~/lib/api/endpoint';

const checkUpdatesEndpoint = endpoint(
	{ body: updatesRequestSchema, query: Type.Undefined(), response: updatesResponseSchema },
	({ ctx, body }) => findUpdates(ctx, body),
	{ rateLimit: { bucket: 'updates', budget: 'UPDATES' } },
);

export default checkUpdatesEndpoint;
