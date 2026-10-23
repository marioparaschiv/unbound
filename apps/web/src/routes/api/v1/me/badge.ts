import { createFileRoute } from '@tanstack/react-router';

import removeMyBadge from '~/endpoints/remove-my-badge';
import setMyBadge from '~/endpoints/set-my-badge';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/badge')({
	server: {
		handlers: {
			PUT: serve(setMyBadge),
			DELETE: serve(removeMyBadge),
		},
	},
});
