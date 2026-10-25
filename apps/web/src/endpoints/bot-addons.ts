import { botAddonsResponseSchema, botFeedQuerySchema } from '@unbound-app/contracts/bot';
import { z } from 'zod';

import { readChangeFeed } from '~/lib/bot/feed';
import { requireCaller } from '~/lib/api/caller';
import { addonsFeed } from '~/lib/bot/addons';
import endpoint from '~/lib/api/endpoint';

const botAddonsEndpoint = endpoint(
	{ body: z.undefined(), query: botFeedQuerySchema, response: botAddonsResponseSchema },
	async ({ ctx, request, query }) => {
		const caller = await requireCaller(ctx, request.headers);

		return readChangeFeed(ctx, caller, addonsFeed, query);
	},
);

export default botAddonsEndpoint;
