import { createFileRoute } from '@tanstack/react-router';

import publishFirstParty from '~/endpoints/publish-first-party';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/first-party/publish')({
	server: {
		handlers: {
			POST: serve(publishFirstParty),
		},
	},
});
