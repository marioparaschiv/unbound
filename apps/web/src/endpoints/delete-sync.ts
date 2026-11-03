import { syncDeleteResponseSchema } from '@unbound-app/contracts/sync';
import { Type } from '@unbound-app/contracts/schema';

import { deleteSyncDocument } from '~/lib/sync-documents';
import { callerEndpoint } from '~/lib/api/endpoint';

const deleteSyncEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: syncDeleteResponseSchema },
	async ({ ctx, caller: { user } }) => {
		return { deleted: await deleteSyncDocument(ctx, user.id) };
	},
);

export default deleteSyncEndpoint;
