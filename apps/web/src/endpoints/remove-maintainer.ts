import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { removeMaintainer } from '~/lib/maintainers';
import { requireCaller } from '~/lib/api/caller';

const removeMaintainerEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		return removeMaintainer(
			ctx,
			caller,
			requireParam(params, 'id'),
			requireParam(params, 'userId'),
		);
	},
);

export default removeMaintainerEndpoint;
