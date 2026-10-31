import {
	listRepositoryAddonsQuerySchema,
	listRepositoryAddonsResponseSchema,
} from '@unbound-app/contracts/source';
import { z } from 'zod';

import { listRepositoryAddons } from '~/lib/addon-source';
import { callerEndpoint } from '~/lib/api/endpoint';
import { connectGitHub } from '~/lib/github';

const listRepositoryAddonsEndpoint = callerEndpoint(
	{
		body: z.undefined(),
		query: listRepositoryAddonsQuerySchema,
		response: listRepositoryAddonsResponseSchema,
	},
	async ({ ctx, query, caller: { user } }) => {
		const github = await connectGitHub(ctx, user.id);

		return listRepositoryAddons(ctx, github, query);
	},
);

export default listRepositoryAddonsEndpoint;
