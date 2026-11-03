import { addonVersionsResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { listAddonVersions } from '~/lib/addons';
import { ApiError } from '~/lib/api/errors';

const listAddonVersionsEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: addonVersionsResponseSchema },
	async ({ ctx, params }) => {
		const id = requireParam(params, 'id');
		const versions = await listAddonVersions(ctx, id);

		if (!versions) {
			throw new ApiError('not_found', `Addon ${id} does not exist.`);
		}

		return { versions };
	},
);

export default listAddonVersionsEndpoint;
