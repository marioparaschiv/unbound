import {
	listDiscordCompatQuerySchema,
	listDiscordCompatResponseSchema,
} from '@unbound-app/contracts/discord-compat';
import { Type } from '@unbound-app/contracts/schema';

import { listDiscordCompat } from '~/lib/discord-compat';
import endpoint from '~/lib/api/endpoint';

const listDiscordCompatEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: listDiscordCompatQuerySchema,
		response: listDiscordCompatResponseSchema,
	},
	async ({ ctx, query }) => ({ versions: await listDiscordCompat(ctx, query.platform) }),
);

export default listDiscordCompatEndpoint;
