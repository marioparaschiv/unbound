import { createFileRoute } from '@tanstack/react-router';

import publishDiscordCompat from '~/endpoints/publish-discord-compat';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/compat')({
	server: {
		handlers: {
			POST: serve(publishDiscordCompat),
		},
	},
});
