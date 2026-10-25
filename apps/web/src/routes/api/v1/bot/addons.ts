import { createFileRoute } from '@tanstack/react-router';

import botAddons from '~/endpoints/bot-addons';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/bot/addons')({
	server: {
		handlers: {
			GET: serve(botAddons),
		},
	},
});
