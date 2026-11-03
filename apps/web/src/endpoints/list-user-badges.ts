import { userBadgesResponseSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { getVisibleBadges } from '~/lib/sponsors/badges';

const listUserBadgesEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: userBadgesResponseSchema },
	async ({ ctx, params }) => {
		const userId = requireParam(params, 'id');
		const badges = (await getVisibleBadges(ctx, [userId])).get(userId);

		return { badges: badges ?? [] };
	},
);

export default listUserBadgesEndpoint;
