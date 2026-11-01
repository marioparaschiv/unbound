import { createFileRoute } from '@tanstack/react-router';

import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import AddonListing from '~/components/addon-listing';

function IconsTab() {
	return <AddonListing type='icon-pack' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/addons/_listing/icons')({
	head: () => ({ meta: [{ title: 'Unbound | Icons' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'icon-pack', deps, cause),
	component: IconsTab,
});
