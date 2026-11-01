import { createFileRoute, notFound, Outlet, useParams } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { LATEST_DOCS_ALIAS, redirectToLatestDocs } from '~/lib/docs/latest-docs';
import { docsManifestQuery, docsNavQuery } from '~/queries/docs/docs';
import DocsSidebar from '~/components/docs/docs-sidebar';
import DocsSearch from '~/components/docs/docs-search';
import { parseDocsRoute } from '~/lib/docs/docs-links';
import DocsShell from '~/components/docs/docs-shell';
import { getSearchEntries } from '~/lib/docs/search';

function DocsLayout() {
	const route = Route.useLoaderData();
	const symbol = useParams({ strict: false, select: (params) => params.symbol });
	const { data: nav } = useSuspenseQuery(docsNavQuery(route.package, route.version));
	const entries = useMemo(() => (nav ? getSearchEntries(nav) : []), [nav]);

	if (!nav) {
		throw notFound();
	}

	return (
		<DocsShell
			label='API reference'
			title={symbol ?? `@unbound-app/${route.package}`}
			sidebar={<DocsSidebar nav={nav} symbol={symbol} />}
			renderSearch={(state) => <DocsSearch entries={entries} route={route} {...state} />}
		>
			<Outlet />
		</DocsShell>
	);
}

export const Route = createFileRoute('/_site/docs/$package/$version')({
	// Before any loader, so the child pages never try to read `latest` as a version.
	beforeLoad: async ({ context, params }) => {
		if (params.version !== LATEST_DOCS_ALIAS) return;

		// Every match shares the location's params, so the child's symbol is here too.
		const symbol =
			'symbol' in params && typeof params.symbol === 'string' ? params.symbol : undefined;

		await redirectToLatestDocs(
			(pkg) => context.queryClient.ensureQueryData(docsManifestQuery(pkg)),
			params.package,
			symbol,
		);
	},
	loader: async ({ context, params }) => {
		const route = parseDocsRoute(params);
		const nav = route
			? await context.queryClient.ensureQueryData(docsNavQuery(route.package, route.version))
			: null;

		if (!route || !nav) {
			throw notFound();
		}

		return route;
	},
	component: DocsLayout,
});
