import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { removeBadge } from '~/lib/sponsors/badges';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const removeMyBadgeEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, request }) => {
		const caller = await requireCaller(ctx, request.headers);

		return removeBadge(ctx, caller.user.id);
	},
);

export default removeMyBadgeEndpoint;
