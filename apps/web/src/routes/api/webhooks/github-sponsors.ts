import { createFileRoute } from '@tanstack/react-router';

import { handleSponsorsWebhook } from '~/lib/sponsors/webhook';
import type { ServerHandlerArgs } from '~/lib/api/serve';
import { getApp } from '~/lib/app';

// Not an `endpoint`: the signature covers the raw body, which must reach the handler unparsed.
function handler({ request }: ServerHandlerArgs) {
	return handleSponsorsWebhook(getApp(), request);
}

export const Route = createFileRoute('/api/webhooks/github-sponsors')({
	server: {
		handlers: {
			POST: handler,
		},
	},
});
