import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { removeBadges } from '~/lib/sponsors/badges';
import { callerEndpoint } from '~/lib/api/endpoint';

const removeMyBadgesEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, caller }) => {
		return removeBadges(ctx, caller.user.id);
	},
);

export default removeMyBadgesEndpoint;
