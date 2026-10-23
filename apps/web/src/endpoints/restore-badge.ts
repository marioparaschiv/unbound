import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { restoreBadge } from '~/lib/sponsors/badges';
import { requireCaller } from '~/lib/api/caller';

const restoreBadgeEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		return restoreBadge(ctx, caller, requireParam(params, 'id'));
	},
);

export default restoreBadgeEndpoint;
