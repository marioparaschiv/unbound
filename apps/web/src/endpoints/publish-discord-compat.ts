import {
	publishDiscordCompatRequestSchema,
	publishDiscordCompatResponseSchema,
} from '@unbound-app/contracts/discord-compat';
import { Type } from '@unbound-app/contracts/schema';

import { publishDiscordCompat } from '~/lib/discord-compat';
import { callerEndpoint } from '~/lib/api/endpoint';

const publishDiscordCompatEndpoint = callerEndpoint(
	{
		body: publishDiscordCompatRequestSchema,
		query: Type.Undefined(),
		response: publishDiscordCompatResponseSchema,
	},
	async ({ ctx, body, caller }) => ({ recorded: await publishDiscordCompat(ctx, caller, body) }),
);

export default publishDiscordCompatEndpoint;
