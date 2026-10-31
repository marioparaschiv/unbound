import { createFileRoute } from '@tanstack/react-router';

import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import AddonListing from '~/components/addon-listing';

function PluginsPage() {
	return <AddonListing type='plugin' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/plugins')({
	head: () => ({ meta: [{ title: 'Unbound | Plugins' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'plugin', deps, cause),
	component: PluginsPage,
});
