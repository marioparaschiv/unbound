import { syncSignInRequestSchema, syncSignInResponseSchema } from '@unbound-app/contracts/sync';
import { getIP } from 'better-auth/api';
import { z } from 'zod';

import { signInWithDiscordCode } from '~/lib/sync-sign-in';
import { consumeRateLimit } from '~/lib/rate-limit';
import endpoint from '~/lib/api/endpoint';

const syncSignInEndpoint = endpoint(
	{ body: syncSignInRequestSchema, query: z.undefined(), response: syncSignInResponseSchema },
	async ({ ctx, request, body }) => {
		// Without a trustworthy client IP, requests share one bucket rather than going unlimited.
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		consumeRateLimit(ctx, {
			key: `api:sync-sign-in:${ip}`,
			windowSeconds: ctx.env.SYNC_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.SYNC_SIGN_IN_RATE_LIMIT_MAX,
		});

		return signInWithDiscordCode(ctx, body.code);
	},
);

export default syncSignInEndpoint;
