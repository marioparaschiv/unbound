import { createFileRoute } from '@tanstack/react-router';

import countAddonInstall from '~/endpoints/count-addon-install';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/installs')({
	server: {
		handlers: {
			POST: serve(countAddonInstall),
		},
	},
});
