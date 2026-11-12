import { createFileRoute } from '@tanstack/react-router';

import AddonListingSkeleton from '~/components/addon-listing-skeleton';
import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import { schemaValidator } from '~/lib/schema-validator';
import AddonListing from '~/components/addon-listing';

function ThemesTab() {
	return <AddonListing type='theme' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/addons/_listing/themes')({
	head: () => ({ meta: [{ title: 'Unbound | Themes' }] }),
	validateSearch: schemaValidator(marketplaceSearchSchema),
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'theme', deps, cause),
	// Shows the skeleton soon after a slow navigation starts, rather than leaving the last page up.
	pendingMs: 150,
	pendingComponent: () => <AddonListingSkeleton type='theme' />,
	component: ThemesTab,
});
