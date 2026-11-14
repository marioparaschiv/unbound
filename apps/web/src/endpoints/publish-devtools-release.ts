import {
	devtoolsReleaseSchema,
	publishDevtoolsReleaseRequestSchema,
} from '@unbound-app/contracts/devtools';
import { Type } from '@unbound-app/contracts/schema';

import { publishDevtoolsRelease } from '~/lib/devtools-releases';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishDevtoolsReleaseEndpoint = callerEndpoint(
	{
		body: publishDevtoolsReleaseRequestSchema,
		query: Type.Undefined(),
		response: devtoolsReleaseSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishDevtoolsRelease(ctx, caller, body);
	},
);

export default publishDevtoolsReleaseEndpoint;
