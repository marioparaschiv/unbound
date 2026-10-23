import { userBadgesResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { getVisibleBadges } from '~/lib/sponsors/badges';

const listUserBadgesEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: userBadgesResponseSchema },
	async ({ ctx, params }) => {
		const userId = requireParam(params, 'id');
		const badge = (await getVisibleBadges(ctx, [userId])).get(userId);

		return { badges: badge ? [badge] : [] };
	},
);

export default listUserBadgesEndpoint;
