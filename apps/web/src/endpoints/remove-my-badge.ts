import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { removeBadge } from '~/lib/sponsors/badges';

const removeMyBadgeEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, caller }) => {
		return removeBadge(ctx, caller.user.id);
	},
);

export default removeMyBadgeEndpoint;
