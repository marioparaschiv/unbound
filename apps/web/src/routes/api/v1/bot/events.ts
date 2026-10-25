import { createFileRoute } from '@tanstack/react-router';

import botEvents from '~/endpoints/bot-events';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/bot/events')({
	server: {
		handlers: {
			GET: serve(botEvents),
		},
	},
});
