import { addonIconResponseSchema, setAddonIconRequestSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { setAddonIcon } from '~/lib/addon-icon-setting';
import { requireCaller } from '~/lib/api/caller';

const setAddonIconEndpoint = endpoint(
	{ body: setAddonIconRequestSchema, query: z.undefined(), response: addonIconResponseSchema },
	async ({ ctx, request, params, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return setAddonIcon(ctx, caller, requireParam(params, 'id'), body.icon);
	},
);

export default setAddonIconEndpoint;
