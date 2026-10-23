import { badgeClaimResponseSchema, badgeSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { claimBadge } from '~/lib/sponsors/badges';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const setMyBadgeEndpoint = endpoint(
	{ body: badgeSchema, query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, request, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return claimBadge(ctx, caller.user.id, body);
	},
);

export default setMyBadgeEndpoint;
