import {
	accountSignInRequestSchema,
	accountSignInResponseSchema,
} from '@unbound-app/contracts/account';
import { getIP } from 'better-auth/api';
import { z } from 'zod';

import { signInWithDiscordCode } from '~/lib/discord-sign-in';
import { consumeRateLimit } from '~/lib/rate-limit';
import endpoint from '~/lib/api/endpoint';

const discordSignInEndpoint = endpoint(
	{
		body: accountSignInRequestSchema,
		query: z.undefined(),
		response: accountSignInResponseSchema,
	},
	async ({ ctx, request, body }) => {
		// Without a trustworthy client IP, requests share one bucket rather than going unlimited.
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		await consumeRateLimit(ctx, {
			key: `api:discord-sign-in:${ip}`,
			windowSeconds: ctx.env.SYNC_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.SYNC_SIGN_IN_RATE_LIMIT_MAX,
		});

		return signInWithDiscordCode(ctx, body.code);
	},
);

export default discordSignInEndpoint;
