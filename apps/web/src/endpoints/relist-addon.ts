import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { relistAddon } from '~/lib/addons';

const relistAddonEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: addonResponseSchema },
	async ({ ctx, params, caller }) => {
		return relistAddon(ctx, caller, requireParam(params, 'id'));
	},
);

export default relistAddonEndpoint;
