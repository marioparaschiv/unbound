import { userBadgesResponseSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { getUserBadges } from '~/lib/sponsors/badges';

const listUserBadgesEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: userBadgesResponseSchema },
	async ({ ctx, params }) => ({ badges: await getUserBadges(ctx, requireParam(params, 'id')) }),
);

export default listUserBadgesEndpoint;
