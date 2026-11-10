import { createServerFn } from '@tanstack/react-start';

import type { OpenApiDocument } from '~/lib/api/openapi/openapi-document';
import { getOpenApiDocument } from '~/lib/api/openapi/served-operations';
import { getApp } from '~/lib/app';

/**
 * @description Loads the OpenAPI document of the public HTTP API, the one `/api/v1/openapi.json` serves.
 * @returns The document.
 */
export const fetchOpenApiDocument = createServerFn({ method: 'GET' }).handler(
	(): Promise<OpenApiDocument> => getOpenApiDocument(getApp().env.PUBLIC_URL),
);
