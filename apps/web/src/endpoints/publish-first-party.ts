import {
	publishFirstPartyRequestSchema,
	publishFirstPartyResponseSchema,
} from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { publishFirstParty } from '~/lib/first-party';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishFirstPartyEndpoint = callerEndpoint(
	{
		body: publishFirstPartyRequestSchema,
		query: z.undefined(),
		response: publishFirstPartyResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishFirstParty(ctx, caller, body);
	},
);

export default publishFirstPartyEndpoint;
