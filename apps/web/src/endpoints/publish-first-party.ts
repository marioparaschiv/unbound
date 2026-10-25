import {
	publishFirstPartyRequestSchema,
	publishFirstPartyResponseSchema,
} from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { publishFirstParty } from '~/lib/first-party';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const publishFirstPartyEndpoint = endpoint(
	{
		body: publishFirstPartyRequestSchema,
		query: z.undefined(),
		response: publishFirstPartyResponseSchema,
	},
	async ({ ctx, request, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return publishFirstParty(ctx, caller, body);
	},
);

export default publishFirstPartyEndpoint;
