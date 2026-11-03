import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { Type } from '@unbound-app/contracts/schema';

import { getCatalog } from '~/lib/addons';
import endpoint from '~/lib/api/endpoint';

const getCatalogEndpoint = endpoint(
	{ body: Type.Undefined(), query: Type.Undefined(), response: catalogResponseSchema },
	async ({ ctx }) => getCatalog(ctx),
	{ etag: (catalog) => catalog.revision },
);

export default getCatalogEndpoint;
