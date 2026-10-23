import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { listMaintainers } from '~/lib/maintainers';

const listMaintainersEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, params }) => listMaintainers(ctx, requireParam(params, 'id')),
);

export default listMaintainersEndpoint;
