import { accountOAuthConfigSchema } from '@unbound-app/contracts/account';
import { z } from 'zod';

import { getDiscordOAuthConfig } from '~/lib/discord-sign-in';
import endpoint from '~/lib/api/endpoint';

const getDiscordOAuthEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: accountOAuthConfigSchema },
	async ({ ctx }) => getDiscordOAuthConfig(ctx.env),
);

export default getDiscordOAuthEndpoint;
