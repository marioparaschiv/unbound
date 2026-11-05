import { createFileRoute } from '@tanstack/react-router';

import resolveFont from '~/endpoints/resolve-font';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/fonts/resolve')({
	server: {
		handlers: {
			GET: serve(resolveFont),
		},
	},
});
