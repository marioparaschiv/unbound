import {
	publishFirstPartyRequestSchema,
	publishFirstPartyResponseSchema,
} from '@unbound-app/contracts/publish';
import { Type } from '@unbound-app/contracts/schema';

import { publishFirstParty } from '~/lib/first-party';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishFirstPartyEndpoint = callerEndpoint(
	{
		body: publishFirstPartyRequestSchema,
		query: Type.Undefined(),
		response: publishFirstPartyResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishFirstParty(ctx, caller, body);
	},
);

export default publishFirstPartyEndpoint;
