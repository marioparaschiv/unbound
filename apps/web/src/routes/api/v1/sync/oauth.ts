import { createFileRoute } from '@tanstack/react-router';

import getSyncOAuth from '~/endpoints/get-sync-oauth';
import syncSignIn from '~/endpoints/sync-sign-in';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/sync/oauth')({
	server: {
		handlers: {
			GET: serve(getSyncOAuth),
			POST: serve(syncSignIn),
		},
	},
});
