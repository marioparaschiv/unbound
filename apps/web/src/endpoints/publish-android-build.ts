import {
	androidBuildSchema,
	publishAndroidBuildRequestSchema,
} from '@unbound-app/contracts/android-builds';
import { Type } from '@unbound-app/contracts/schema';

import { publishAndroidBuild } from '~/lib/android-builds';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishAndroidBuildEndpoint = callerEndpoint(
	{
		body: publishAndroidBuildRequestSchema,
		query: Type.Undefined(),
		response: androidBuildSchema,
	},
	async ({ ctx, body, caller }) => {
		return publishAndroidBuild(ctx, caller, body);
	},
);

export default publishAndroidBuildEndpoint;
