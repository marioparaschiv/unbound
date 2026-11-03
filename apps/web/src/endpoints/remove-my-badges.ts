import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import { removeBadges } from '~/lib/sponsors/badges';
import { callerEndpoint } from '~/lib/api/endpoint';

const removeMyBadgesEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, caller }) => {
		return removeBadges(ctx, caller.user.id);
	},
);

export default removeMyBadgesEndpoint;
