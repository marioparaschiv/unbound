import { badgeClaimResponseSchema, setBadgesRequestSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint } from '~/lib/api/endpoint';
import { claimBadges } from '~/lib/sponsors/badges';

const setMyBadgesEndpoint = callerEndpoint(
	{ body: setBadgesRequestSchema, query: Type.Undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, body, caller }) => {
		return claimBadges(ctx, caller.user.id, body.badges);
	},
);

export default setMyBadgesEndpoint;
