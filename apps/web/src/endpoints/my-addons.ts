import { myAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { listMyAddons } from '~/lib/addons';

const myAddonsEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: myAddonsResponseSchema },
	async ({ ctx, caller }) => {
		return listMyAddons(ctx, caller);
	},
);

export default myAddonsEndpoint;
