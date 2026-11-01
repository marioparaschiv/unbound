import { createFileRoute } from '@tanstack/react-router';

import getDiscordOAuth from '~/endpoints/get-discord-oauth';
import discordSignIn from '~/endpoints/discord-sign-in';
import serve from '~/lib/api/serve';

/** @deprecated Released clients still sign in here; new clients use `/api/v1/auth/discord`. */
export const Route = createFileRoute('/api/v1/sync/oauth')({
	server: {
		handlers: {
			GET: serve(getDiscordOAuth),
			POST: serve(discordSignIn),
		},
	},
});
