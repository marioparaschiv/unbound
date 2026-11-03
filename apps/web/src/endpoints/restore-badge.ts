import { badgeClaimResponseSchema } from '@unbound-app/contracts/sponsors';
import { Type } from '@unbound-app/contracts/schema';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { restoreBadge } from '~/lib/sponsors/badges';

const restoreBadgeEndpoint = callerEndpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, params, caller }) => {
		return restoreBadge(ctx, caller, requireParam(params, 'id'));
	},
);

export default restoreBadgeEndpoint;
