import { loaderUpdateQuerySchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import { getIP } from 'better-auth/api';
import { z } from 'zod';

import { findLoaderUpdate } from '~/lib/loader-releases';
import { consumeRateLimit } from '~/lib/rate-limit';
import endpoint from '~/lib/api/endpoint';

const checkLoaderUpdateEndpoint = endpoint(
	{ body: z.undefined(), query: loaderUpdateQuerySchema, response: loaderUpdateResponseSchema },
	async ({ ctx, request, query }) => {
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		consumeRateLimit(ctx, {
			key: `api:loader-updates:${ip}`,
			windowSeconds: ctx.env.UPDATES_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.UPDATES_RATE_LIMIT_MAX,
		});

		return findLoaderUpdate(ctx, query);
	},
);

export default checkLoaderUpdateEndpoint;
