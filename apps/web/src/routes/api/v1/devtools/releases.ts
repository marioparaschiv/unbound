import { createFileRoute } from '@tanstack/react-router';

import publishDevtoolsRelease from '~/endpoints/publish-devtools-release';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/devtools/releases')({
	server: {
		handlers: {
			POST: serve(publishDevtoolsRelease),
		},
	},
});
