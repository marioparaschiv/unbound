import { botEventsResponseSchema, botFeedQuerySchema } from '@unbound-app/contracts/bot';
import { z } from 'zod';

import { requireCaller } from '~/lib/api/caller';
import { listBotEvents } from '~/lib/bot/events';
import endpoint from '~/lib/api/endpoint';

const botEventsEndpoint = endpoint(
	{ body: z.undefined(), query: botFeedQuerySchema, response: botEventsResponseSchema },
	async ({ ctx, request, query }) => {
		const caller = await requireCaller(ctx, request.headers);

		return listBotEvents(ctx, caller, query);
	},
);

export default botEventsEndpoint;
