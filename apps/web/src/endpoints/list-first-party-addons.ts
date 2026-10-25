import { listFirstPartyAddonsResponseSchema } from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { listFirstPartyAddons } from '~/lib/first-party';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const listFirstPartyAddonsEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: listFirstPartyAddonsResponseSchema },
	async ({ ctx, request }) => {
		const caller = await requireCaller(ctx, request.headers);

		return listFirstPartyAddons(ctx, caller);
	},
);

export default listFirstPartyAddonsEndpoint;
