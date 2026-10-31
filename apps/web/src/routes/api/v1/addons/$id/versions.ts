import { createFileRoute } from '@tanstack/react-router';

import listAddonVersions from '~/endpoints/list-addon-versions';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/versions')({
	server: {
		handlers: {
			GET: serve(listAddonVersions),
		},
	},
});
