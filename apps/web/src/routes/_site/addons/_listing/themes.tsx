import { createFileRoute } from '@tanstack/react-router';

import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/addon-filters';
import AddonListing from '~/components/addon-listing';

function ThemesTab() {
	return <AddonListing type='theme' search={Route.useSearch()} />;
}

export const Route = createFileRoute('/_site/addons/_listing/themes')({
	head: () => ({ meta: [{ title: 'Unbound | Themes' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps, cause }) =>
		prefetchListing(context.queryClient, 'theme', deps, cause),
	component: ThemesTab,
});
