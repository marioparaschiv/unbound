import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { restoreBadge } from '~/lib/sponsors/badges';

const restoreBadgeEndpoint = callerEndpoint(
	{ body: z.undefined(), query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, params, caller }) => {
		return restoreBadge(ctx, caller, requireParam(params, 'id'));
	},
);

export default restoreBadgeEndpoint;
