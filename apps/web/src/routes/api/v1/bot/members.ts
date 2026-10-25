import { createFileRoute } from '@tanstack/react-router';

import botMembers from '~/endpoints/bot-members';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/bot/members')({
	server: {
		handlers: {
			GET: serve(botMembers),
		},
	},
});
