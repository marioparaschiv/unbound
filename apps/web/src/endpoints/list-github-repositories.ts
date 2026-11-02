import { pushableRepositoriesResponseSchema } from '@unbound-app/contracts/source';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { connectGitHub } from '~/lib/github';

const listGitHubRepositoriesEndpoint = callerEndpoint(
	{
		body: Type.Undefined(),
		query: Type.Undefined(),
		response: pushableRepositoriesResponseSchema,
	},
	async ({ ctx, caller: { user } }) => {
		const github = await connectGitHub(ctx, user.id);

		return { repositories: await github.listPushable() };
	},
);

export default listGitHubRepositoriesEndpoint;
