import { listFirstPartyAddonsResponseSchema } from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { listFirstPartyAddons } from '~/lib/first-party';
import { callerEndpoint } from '~/lib/api/endpoint';

const listFirstPartyAddonsEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: listFirstPartyAddonsResponseSchema },
	async ({ ctx, caller }) => {
		return listFirstPartyAddons(ctx, caller);
	},
);

export default listFirstPartyAddonsEndpoint;
