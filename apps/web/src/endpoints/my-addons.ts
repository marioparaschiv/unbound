import { myAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { listMyAddons } from '~/lib/addons';

const myAddonsEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: myAddonsResponseSchema },
	async ({ ctx, caller }) => {
		return listMyAddons(ctx, caller);
	},
);

export default myAddonsEndpoint;
