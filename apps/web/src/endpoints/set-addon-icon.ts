import { addonIconResponseSchema, setAddonIconRequestSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { setAddonIcon } from '~/lib/addon-icon-setting';

const setAddonIconEndpoint = callerEndpoint(
	{ body: setAddonIconRequestSchema, query: Type.Undefined(), response: addonIconResponseSchema },
	async ({ ctx, params, body, caller }) => {
		return setAddonIcon(ctx, caller, requireParam(params, 'id'), body.icon);
	},
);

export default setAddonIconEndpoint;
