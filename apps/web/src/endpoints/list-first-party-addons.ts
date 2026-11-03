import { listFirstPartyAddonsResponseSchema } from '@unbound-app/contracts/publish';
import { Type } from '@unbound-app/contracts/schema';

import { listFirstPartyAddons } from '~/lib/first-party';
import { callerEndpoint } from '~/lib/api/endpoint';

const listFirstPartyAddonsEndpoint = callerEndpoint(
	{
		body: Type.Undefined(),
		query: Type.Undefined(),
		response: listFirstPartyAddonsResponseSchema,
	},
	async ({ ctx, caller }) => {
		return listFirstPartyAddons(ctx, caller);
	},
);

export default listFirstPartyAddonsEndpoint;
