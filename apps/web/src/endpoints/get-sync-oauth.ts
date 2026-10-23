import { syncOAuthConfigSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { getSyncOAuthConfig } from '~/lib/sync-sign-in';
import endpoint from '~/lib/api/endpoint';

const getSyncOAuthEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: syncOAuthConfigSchema },
	async ({ ctx }) => getSyncOAuthConfig(ctx.env),
);

export default getSyncOAuthEndpoint;
