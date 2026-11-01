import { createFileRoute } from '@tanstack/react-router';

import getDiscordOAuth from '~/endpoints/get-discord-oauth';
import discordSignIn from '~/endpoints/discord-sign-in';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/auth/discord')({
	server: {
		handlers: {
			GET: serve(getDiscordOAuth),
			POST: serve(discordSignIn),
		},
	},
});
