import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { delistAddon } from '~/lib/addons';

const delistAddonEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: addonResponseSchema },
	async ({ ctx, params, caller }) => {
		return delistAddon(ctx, caller, requireParam(params, 'id'));
	},
);

export default delistAddonEndpoint;
