import { listAddonsQuerySchema, listAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { listAddons } from '~/lib/addons';
import endpoint from '~/lib/api/endpoint';

const listAddonsEndpoint = endpoint(
	{ body: Type.Undefined(), query: listAddonsQuerySchema, response: listAddonsResponseSchema },
	async ({ ctx, query }) => listAddons(ctx, query),
);

export default listAddonsEndpoint;
