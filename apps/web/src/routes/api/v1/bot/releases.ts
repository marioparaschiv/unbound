import { createFileRoute } from '@tanstack/react-router';

import botReleases from '~/endpoints/bot-releases';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/bot/releases')({
	server: {
		handlers: {
			GET: serve(botReleases),
		},
	},
});
