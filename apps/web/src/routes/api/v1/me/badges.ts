import { createFileRoute } from '@tanstack/react-router';

import removeMyBadges from '~/endpoints/remove-my-badges';
import setMyBadges from '~/endpoints/set-my-badges';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/badges')({
	server: {
		handlers: {
			PUT: serve(setMyBadges),
			DELETE: serve(removeMyBadges),
		},
	},
});
