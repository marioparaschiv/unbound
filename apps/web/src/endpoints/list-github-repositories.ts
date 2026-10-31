import { pushableRepositoriesResponseSchema } from '@unbound-app/contracts/source';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { connectGitHub } from '~/lib/github';

const listGitHubRepositoriesEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: pushableRepositoriesResponseSchema },
	async ({ ctx, caller: { user } }) => {
		const github = await connectGitHub(ctx, user.id);

		return { repositories: await github.listPushable() };
	},
);

export default listGitHubRepositoriesEndpoint;
