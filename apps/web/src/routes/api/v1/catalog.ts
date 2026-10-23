import { createFileRoute } from '@tanstack/react-router';

import getCatalog from '~/endpoints/get-catalog';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/catalog')({
	server: {
		handlers: {
			GET: serve(getCatalog),
		},
	},
});
