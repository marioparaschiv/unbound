import { createFileRoute } from '@tanstack/react-router';

import AddonListingSkeleton from '~/components/addon-listing-skeleton';
import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import { schemaValidator } from '~/lib/schema-validator';
import AddonListing from '~/components/addon-listing';

function IconsTab() {
	return <AddonListing type='icon-pack' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/addons/_listing/icons')({
	head: () => ({ meta: [{ title: 'Unbound | Icons' }] }),
	validateSearch: schemaValidator(marketplaceSearchSchema),
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'icon-pack', deps, cause),
	// Shows the skeleton soon after a slow navigation starts, rather than leaving the last page up.
	pendingMs: 150,
	pendingComponent: () => <AddonListingSkeleton type='icon-pack' />,
	component: IconsTab,
});
