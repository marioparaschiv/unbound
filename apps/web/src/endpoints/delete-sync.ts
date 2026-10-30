import { syncDeleteResponseSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { deleteSyncDocument } from '~/lib/sync-documents';
import { callerEndpoint } from '~/lib/api/endpoint';

const deleteSyncEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: syncDeleteResponseSchema },
	async ({ ctx, caller: { user } }) => {
		return { deleted: await deleteSyncDocument(ctx, user.id) };
	},
);

export default deleteSyncEndpoint;
