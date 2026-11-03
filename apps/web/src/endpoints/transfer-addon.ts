import {
	maintainersResponseSchema,
	transferAddonRequestSchema,
} from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { transferAddon } from '~/lib/maintainers';

const transferAddonEndpoint = callerEndpoint(
	{
		body: transferAddonRequestSchema,
		query: Type.Undefined(),
		response: maintainersResponseSchema,
	},
	async ({ ctx, params, body, caller }) => {
		return transferAddon(ctx, caller, requireParam(params, 'id'), body);
	},
);

export default transferAddonEndpoint;
