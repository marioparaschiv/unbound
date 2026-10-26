import { updatesRequestSchema, updatesResponseSchema } from '@unbound-app/contracts/updates';
import { getIP } from 'better-auth/api';
import { z } from 'zod';

import { consumeRateLimit } from '~/lib/rate-limit';
import { findUpdates } from '~/lib/updates';
import endpoint from '~/lib/api/endpoint';

const checkUpdatesEndpoint = endpoint(
	{ body: updatesRequestSchema, query: z.undefined(), response: updatesResponseSchema },
	async ({ ctx, request, body }) => {
		// Without a trustworthy client IP, requests share one bucket rather than going unlimited.
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		await consumeRateLimit(ctx, {
			key: `api:updates:${ip}`,
			windowSeconds: ctx.env.UPDATES_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.UPDATES_RATE_LIMIT_MAX,
		});

		return findUpdates(ctx, body);
	},
);

export default checkUpdatesEndpoint;
