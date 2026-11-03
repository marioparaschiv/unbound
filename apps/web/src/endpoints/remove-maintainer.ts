import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { removeMaintainer } from '~/lib/maintainers';

const removeMaintainerEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: maintainersResponseSchema },
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
