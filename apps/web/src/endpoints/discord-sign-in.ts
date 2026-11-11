import {
	accountSignInRequestSchema,
	accountSignInResponseSchema,
} from '@unbound-app/contracts/account';
import { Type } from '@unbound-app/contracts/schema';

import { signInWithDiscordCode } from '~/lib/discord-sign-in';
import endpoint from '~/lib/api/endpoint';

const discordSignInEndpoint = endpoint(
	{
		body: accountSignInRequestSchema,
		query: Type.Undefined(),
		response: accountSignInResponseSchema,
	},
	({ ctx, body }) => signInWithDiscordCode(ctx, body.code),
	{ rateLimit: { bucket: 'discord-sign-in', budget: 'SYNC_SIGN_IN' } },
);

export default discordSignInEndpoint;
