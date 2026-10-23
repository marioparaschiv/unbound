import { createFileRoute } from '@tanstack/react-router';

import restoreBadge from '~/endpoints/restore-badge';
import revokeBadge from '~/endpoints/revoke-badge';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/users/$id/badge/revoke')({
	server: {
		handlers: {
			POST: serve(revokeBadge),
			DELETE: serve(restoreBadge),
		},
	},
});
