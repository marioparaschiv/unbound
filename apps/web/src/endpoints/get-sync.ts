import { syncStateSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { getSyncState } from '~/lib/sync-documents';

const getSyncEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: syncStateSchema },
	async ({ ctx, caller: { user } }) => {
		return getSyncState(ctx, user.id);
	},
);

export default getSyncEndpoint;
