import { syncDeleteResponseSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { deleteSyncDocument } from '~/lib/sync-documents';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const deleteSyncEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: syncDeleteResponseSchema },
	async ({ ctx, request }) => {
		const { user } = await requireCaller(ctx, request.headers);

		return { deleted: deleteSyncDocument(ctx, user.id) };
	},
);

export default deleteSyncEndpoint;
