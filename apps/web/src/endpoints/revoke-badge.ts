import {
	badgeClaimResponseSchema,
	revokeBadgeRequestSchema,
} from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { callerEndpoint, requireParam } from '~/lib/api/endpoint';
import { revokeBadge } from '~/lib/sponsors/badges';

const revokeBadgeEndpoint = callerEndpoint(
	{ body: revokeBadgeRequestSchema, query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, params, body, caller }) => {
		return revokeBadge(ctx, caller, requireParam(params, 'id'), body.reason);
	},
);

export default revokeBadgeEndpoint;
