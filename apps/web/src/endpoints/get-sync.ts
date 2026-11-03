import { syncStateSchema } from '@unbound-app/contracts/sync';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { getSyncState } from '~/lib/sync-documents';

const getSyncEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: syncStateSchema },
	async ({ ctx, caller: { user } }) => {
		return getSyncState(ctx, user.id);
	},
);

export default getSyncEndpoint;
