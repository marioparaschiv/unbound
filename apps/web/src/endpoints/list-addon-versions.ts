import { addonVersionsResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { requireAddon } from '~/lib/addon-visibility';
import { listAddonVersions } from '~/lib/addons';

const listAddonVersionsEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: addonVersionsResponseSchema },
	async ({ ctx, params }) => {
		const id = requireParam(params, 'id');

		return { versions: requireAddon(await listAddonVersions(ctx, id), id) };
	},
);

export default listAddonVersionsEndpoint;
