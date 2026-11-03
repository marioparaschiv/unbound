import { createFileRoute } from '@tanstack/react-router';

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
	component: PluginsTab,
});
