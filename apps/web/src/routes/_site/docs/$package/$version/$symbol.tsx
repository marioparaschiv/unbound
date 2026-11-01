import { createFileRoute, notFound } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { docsNavQuery, docsPageQuery } from '~/queries/docs/docs';
import SymbolPage from '~/components/docs/symbol-page';
import { parseDocsRoute } from '~/lib/docs/docs-links';

function DocsSymbolPage() {
	const { route, symbol } = Route.useLoaderData();
	const { data: page } = useSuspenseQuery(docsPageQuery(route.package, route.version, symbol));
	const { data: nav } = useSuspenseQuery(docsNavQuery(route.package, route.version));
	const pages = useMemo(
		() =>
			new Set(
				nav?.groups.flatMap((group) => group.symbols.map((entry) => entry.qualifiedName)),
			),
		[nav],
	);

	if (!page) {
		throw notFound();
	}

	return <SymbolPage page={page} route={route} pages={pages} />;
}

export const Route = createFileRoute('/_site/docs/$package/$version/$symbol')({
	loader: async ({ context, params }) => {
		const route = parseDocsRoute(params);
		const page = route
			? await context.queryClient.ensureQueryData(
					docsPageQuery(route.package, route.version, params.symbol),
				)
			: null;

		if (!route || !page) {
			throw notFound();
		}

		return { route, symbol: params.symbol };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `Unbound | ${loaderData.symbol} · ${loaderData.route.version}`
					: 'Unbound | Docs',
			},
		],
	}),
	component: DocsSymbolPage,
});
