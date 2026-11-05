import { resolvedFontSchema, resolveFontQuerySchema } from '@unbound-app/contracts/fonts';
import { Type } from '@unbound-app/contracts/schema';
import { getIP } from 'better-auth/api';

import { resolveFont } from '~/lib/fonts/resolve-font';
import { consumeRateLimit } from '~/lib/rate-limit';
import endpoint from '~/lib/api/endpoint';

const resolveFontEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: resolveFontQuerySchema,
		response: resolvedFontSchema,
	},
	async ({ ctx, request, query }) => {
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		await consumeRateLimit(ctx, {
			key: `api:fonts:${ip}`,
			windowSeconds: ctx.env.FONTS_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.FONTS_RATE_LIMIT_MAX,
		});

		return resolveFont(query.input);
	},
);

export default resolveFontEndpoint;
