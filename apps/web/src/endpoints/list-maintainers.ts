import { maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { listMaintainers } from '~/lib/maintainers';

const listMaintainersEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: maintainersResponseSchema },
	async ({ ctx, params }) => listMaintainers(ctx, requireParam(params, 'id')),
);

export default listMaintainersEndpoint;
