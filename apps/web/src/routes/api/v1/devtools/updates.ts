import { createFileRoute } from '@tanstack/react-router';

import checkDevtoolsUpdate from '~/endpoints/check-devtools-update';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/devtools/updates')({
	server: {
		handlers: {
			GET: serve(checkDevtoolsUpdate),
		},
	},
});
