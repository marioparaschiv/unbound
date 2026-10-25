import { createFileRoute } from '@tanstack/react-router';

import listFirstPartyAddons from '~/endpoints/list-first-party-addons';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/first-party/addons')({
	server: {
		handlers: {
			GET: serve(listFirstPartyAddons),
		},
	},
});
