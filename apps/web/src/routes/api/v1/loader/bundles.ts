import { createFileRoute } from '@tanstack/react-router';

import publishBundleRelease from '~/endpoints/publish-bundle-release';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/bundles')({
	server: {
		handlers: {
			POST: serve(publishBundleRelease),
		},
	},
});
