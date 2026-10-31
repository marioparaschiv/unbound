import {
	addMaintainerRequestSchema,
	maintainersResponseSchema,
} from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { addMaintainer } from '~/lib/maintainers';

const addMaintainerEndpoint = callerEndpoint(
	{ body: addMaintainerRequestSchema, query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, params, body, caller }) => {
		return addMaintainer(ctx, caller, requireParam(params, 'id'), body.userId);
	},
);

export default addMaintainerEndpoint;
