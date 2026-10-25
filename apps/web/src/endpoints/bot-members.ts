import { botMembersResponseSchema, botFeedQuerySchema } from '@unbound-app/contracts/bot';
import { z } from 'zod';

import { readChangeFeed } from '~/lib/bot/feed';
import { requireCaller } from '~/lib/api/caller';
import { membersFeed } from '~/lib/bot/members';
import endpoint from '~/lib/api/endpoint';

const botMembersEndpoint = endpoint(
	{ body: z.undefined(), query: botFeedQuerySchema, response: botMembersResponseSchema },
	async ({ ctx, request, query }) => {
		const caller = await requireCaller(ctx, request.headers);

		return readChangeFeed(ctx, caller, membersFeed, query);
	},
);

export default botMembersEndpoint;
