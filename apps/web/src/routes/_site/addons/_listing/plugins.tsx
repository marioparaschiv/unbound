import { createFileRoute } from '@tanstack/react-router';

import AddonListingSkeleton from '~/components/addon-listing-skeleton';
import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import { schemaValidator } from '~/lib/schema-validator';
import AddonListing from '~/components/addon-listing';

function PluginsTab() {
	return <AddonListing type='plugin' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/addons/_listing/plugins')({
	head: () => ({ meta: [{ title: 'Unbound | Plugins' }] }),
	validateSearch: schemaValidator(marketplaceSearchSchema),
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'plugin', deps, cause),
	// Shows the skeleton soon after a slow navigation starts, rather than leaving the last page up.
	pendingMs: 150,
	pendingComponent: () => <AddonListingSkeleton type='plugin' />,
	component: PluginsTab,
});
