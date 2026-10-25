import { botReleasesResponseSchema, botFeedQuerySchema } from '@unbound-app/contracts/bot';
import { z } from 'zod';

import { releasesFeed } from '~/lib/bot/releases';
import { requireCaller } from '~/lib/api/caller';
import { readChangeFeed } from '~/lib/bot/feed';
import endpoint from '~/lib/api/endpoint';

const botReleasesEndpoint = endpoint(
	{ body: z.undefined(), query: botFeedQuerySchema, response: botReleasesResponseSchema },
	async ({ ctx, request, query }) => {
		const caller = await requireCaller(ctx, request.headers);

		return readChangeFeed(ctx, caller, releasesFeed, query);
	},
);

export default botReleasesEndpoint;
