import { addonInstallResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';
import { getIP } from 'better-auth/api';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { consumeRateLimit } from '~/lib/rate-limit';
import { countAddonInstall } from '~/lib/addons';
import { ApiError } from '~/lib/api/errors';

const countAddonInstallEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: addonInstallResponseSchema },
	async ({ ctx, request, params }) => {
		const id = requireParam(params, 'id');
		const ip = getIP(request, ctx.auth.options) ?? 'unknown';

		// Keyed per addon so reinstalls from one address count a few times a day at most. The address is hashed.
		await consumeRateLimit(ctx, {
			key: `api:addon-installs:${id}:${new Bun.CryptoHasher('sha256').update(ip).digest('hex')}`,
			windowSeconds: ctx.env.ADDON_INSTALLS_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.ADDON_INSTALLS_RATE_LIMIT_MAX,
		});

		const installs = await countAddonInstall(ctx, id);

		if (installs === undefined) {
			throw new ApiError('not_found', `Addon ${id} does not exist.`);
		}

		return { installs };
	},
);

export default countAddonInstallEndpoint;
