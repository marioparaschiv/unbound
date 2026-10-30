import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { removeMaintainer } from '~/lib/maintainers';

const removeMaintainerEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, params, caller }) => {
		return removeMaintainer(
			ctx,
			caller,
			requireParam(params, 'id'),
			requireParam(params, 'userId'),
		);
	},
);

export default removeMaintainerEndpoint;
