import { syncStateSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { getSyncState } from '~/lib/sync-documents';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const getSyncEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: syncStateSchema },
	async ({ ctx, request }) => {
		const { user } = await requireCaller(ctx, request.headers);

		return getSyncState(ctx, user.id);
	},
);

export default getSyncEndpoint;
