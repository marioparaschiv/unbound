import { badgeClaimResponseSchema, badgeSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { callerEndpoint } from '~/lib/api/endpoint';
import { claimBadge } from '~/lib/sponsors/badges';

const setMyBadgeEndpoint = callerEndpoint(
	{ body: badgeSchema, query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, body, caller }) => {
		return claimBadge(ctx, caller.user.id, body);
	},
);

export default setMyBadgeEndpoint;
