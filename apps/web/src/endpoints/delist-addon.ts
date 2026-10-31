import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { delistAddon } from '~/lib/addons';

const delistAddonEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: addonResponseSchema },
	async ({ ctx, params, caller }) => {
		return delistAddon(ctx, caller, requireParam(params, 'id'));
	},
);

export default delistAddonEndpoint;
