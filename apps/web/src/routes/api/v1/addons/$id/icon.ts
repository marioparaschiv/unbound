import { createFileRoute } from '@tanstack/react-router';

import setAddonIcon from '~/endpoints/set-addon-icon';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/icon')({
	server: {
		handlers: {
			PUT: serve(setAddonIcon),
		},
	},
});
