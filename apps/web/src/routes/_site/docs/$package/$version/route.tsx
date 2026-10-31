import { createFileRoute, notFound, Outlet, useParams } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';

import DocsSidebar from '~/components/docs/docs-sidebar';
import { parseDocsRoute } from '~/lib/docs/docs-links';
import { docsNavQuery } from '~/queries/docs/docs';

function DocsLayout() {
	const route = Route.useLoaderData();
	const symbol = useParams({ strict: false, select: (params) => params.symbol });
	const { data: nav } = useSuspenseQuery(docsNavQuery(route.package, route.version));

	// A refetch can find the version withdrawn since the page loaded.
	if (!nav) {
		throw notFound();
	}

	return (
		<div className='items-start gap-10 grid lg:grid-cols-[18rem_minmax(0,1fr)] page-frame'>
			<aside className='lg:top-6 lg:sticky lg:pr-2 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto'>
				<DocsSidebar nav={nav} symbol={symbol} />
			</aside>
			<main className='min-w-0'>
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute('/_site/docs/$package/$version')({
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
