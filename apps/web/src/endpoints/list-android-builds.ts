import {
	androidBuildsQuerySchema,
	androidBuildsResponseSchema,
} from '@unbound-app/contracts/android-builds';
import { Type } from '@unbound-app/contracts/schema';
import { getIP } from 'better-auth/api';

import { listAndroidBuilds } from '~/lib/android-builds';
import { consumeRateLimit } from '~/lib/rate-limit';
import endpoint from '~/lib/api/endpoint';

const listAndroidBuildsEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: androidBuildsQuerySchema,
		response: androidBuildsResponseSchema,
	},
	async ({ ctx, request, query }) => {
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		await consumeRateLimit(ctx, {
			key: `api:android-builds:${ip}`,
			windowSeconds: ctx.env.UPDATES_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.UPDATES_RATE_LIMIT_MAX,
		});

		return listAndroidBuilds(ctx, query);
	},
);

export default listAndroidBuildsEndpoint;
