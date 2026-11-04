// oxlint-disable oxc-config/kebab-case-filename -- TanStack's `[.]` escapes a literal dot; `openapi.json.ts` would serve `/api/v1/openapi/json`.
import { createFileRoute } from '@tanstack/react-router';

import { getOpenApiDocument } from '~/lib/api/openapi/served-operations';
import app from '~/lib/app';

export const Route = createFileRoute('/api/v1/openapi.json')({
	server: {
		handlers: {
			GET: async () => Response.json(await getOpenApiDocument(app.env.PUBLIC_URL)),
		},
	},
});
