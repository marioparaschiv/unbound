import { createFileRoute } from '@tanstack/react-router';

import publishLoaderRelease from '~/endpoints/publish-loader-release';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/releases')({
	server: {
		handlers: {
			POST: serve(publishLoaderRelease),
		},
	},
});
