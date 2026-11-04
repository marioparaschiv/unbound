import { createFileRoute } from '@tanstack/react-router';

import { fetchOpenApiDocument } from '~/lib/docs/http-functions';
import HttpReference from '~/components/http/http-reference';

function HttpReferencePage() {
	return <HttpReference document={Route.useLoaderData()} />;
}

export const Route = createFileRoute('/_site/docs/api/')({
	loader: () => fetchOpenApiDocument(),
	// The document changes only with a deploy, so a revisit reuses it.
	staleTime: Infinity,
	head: () => ({
		meta: [
			{ title: 'Unbound | API' },
			{
				name: 'description',
				content: 'The public Unbound HTTP API and its OpenAPI document.',
			},
		],
	}),
	component: HttpReferencePage,
});
