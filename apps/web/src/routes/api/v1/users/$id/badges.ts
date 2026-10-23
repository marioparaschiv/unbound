import { createFileRoute } from '@tanstack/react-router';

import listUserBadges from '~/endpoints/list-user-badges';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/users/$id/badges')({
	server: {
		handlers: {
			GET: serve(listUserBadges),
		},
	},
});
