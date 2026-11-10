// oxlint-disable oxc-config/kebab-case-filename -- TanStack's `[.]` escapes a literal dot; `openapi.json.ts` would serve `/api/v1/openapi/json`.
import { createFileRoute } from '@tanstack/react-router';

import { getOpenApiDocument } from '~/lib/api/openapi/served-operations';
import { getApp } from '~/lib/app';

export const Route = createFileRoute('/api/v1/openapi.json')({
	server: {
		handlers: {
			GET: async () => Response.json(await getOpenApiDocument(getApp().env.PUBLIC_URL)),
		},
	},
});
