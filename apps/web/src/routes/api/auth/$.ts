import { createFileRoute } from '@tanstack/react-router';

import { AUTH_ERROR_PATH, RATE_LIMITED_CODE } from '~/lib/auth/auth-errors';
import type { ServerHandlerArgs } from '~/lib/api/serve';
import app from '~/lib/app';

async function handler({ request }: ServerHandlerArgs) {
	const response = await app.auth.handler(request);

	// Only a top-level navigation (the OAuth callback) gets the page; fetch callers keep the JSON 429.
	if (response.status !== 429 || request.headers.get('sec-fetch-mode') !== 'navigate') {
		return response;
	}

	const url = new URL(AUTH_ERROR_PATH, request.url);

	url.searchParams.set('error', RATE_LIMITED_CODE);
	url.searchParams.set('retry_after', response.headers.get('x-retry-after') ?? '0');

	return Response.redirect(url, 302);
}

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
		},
	},
});
