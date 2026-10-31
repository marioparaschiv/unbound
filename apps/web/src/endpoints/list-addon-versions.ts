import { addonVersionsResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { listAddonVersions } from '~/lib/addons';
import { ApiError } from '~/lib/api/errors';

const listAddonVersionsEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: addonVersionsResponseSchema },
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
