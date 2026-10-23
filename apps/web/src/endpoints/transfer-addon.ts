import {
	maintainersResponseSchema,
	transferAddonRequestSchema,
} from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { transferAddon } from '~/lib/maintainers';
import { requireCaller } from '~/lib/api/caller';

const transferAddonEndpoint = endpoint(
	{ body: transferAddonRequestSchema, query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, request, params, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return transferAddon(ctx, caller, requireParam(params, 'id'), body);
	},
);

export default transferAddonEndpoint;
