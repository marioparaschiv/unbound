import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { getCatalog } from '~/lib/addons';
import endpoint from '~/lib/api/endpoint';

const getCatalogEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: catalogResponseSchema },
	async ({ ctx }) => getCatalog(ctx),
	{ etag: (catalog) => catalog.revision },
);

export default getCatalogEndpoint;
