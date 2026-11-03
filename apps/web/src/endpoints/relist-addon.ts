import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { relistAddon } from '~/lib/addons';

const relistAddonEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: addonResponseSchema },
	async ({ ctx, params, caller }) => {
		return relistAddon(ctx, caller, requireParam(params, 'id'));
	},
);

export default relistAddonEndpoint;
