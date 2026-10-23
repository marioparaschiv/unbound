import { createFileRoute } from '@tanstack/react-router';

import checkLoaderUpdate from '~/endpoints/check-loader-update';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/updates')({
	server: {
		handlers: {
			GET: serve(checkLoaderUpdate),
		},
	},
});
