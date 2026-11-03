import { accountOAuthConfigSchema } from '@unbound-app/contracts/account';
import { Type } from '@unbound-app/contracts/schema';

import { getDiscordOAuthConfig } from '~/lib/discord-sign-in';
import endpoint from '~/lib/api/endpoint';

const getDiscordOAuthEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: accountOAuthConfigSchema },
	async ({ ctx }) => getDiscordOAuthConfig(ctx.env),
);

export default getDiscordOAuthEndpoint;
