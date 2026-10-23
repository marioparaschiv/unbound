import {
	badgeClaimResponseSchema,
	revokeBadgeRequestSchema,
} from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { revokeBadge } from '~/lib/sponsors/badges';
import { requireCaller } from '~/lib/api/caller';

const revokeBadgeEndpoint = endpoint(
	{ body: revokeBadgeRequestSchema, query: z.undefined(), response: badgeClaimResponseSchema },
	async ({ ctx, request, params, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return revokeBadge(ctx, caller, requireParam(params, 'id'), body.reason);
	},
);

export default revokeBadgeEndpoint;
