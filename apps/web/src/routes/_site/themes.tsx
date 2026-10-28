import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { prefetchListing } from '~/queries/marketplace/listing';
import { marketplaceSearchSchema } from '~/lib/marketplace';
import type { MarketplaceSearch } from '~/lib/marketplace';
import AddonListing from '~/components/addon-listing';

function ThemesPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const changeSearch = useCallback(
		(next: MarketplaceSearch) => navigate({ search: next }),
		[navigate],
	);

	return <AddonListing type='theme' search={search} onSearchChange={changeSearch} />;
}

export const Route = createFileRoute('/_site/themes')({
	head: () => ({ meta: [{ title: 'Unbound | Themes' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => prefetchListing(context.queryClient, 'theme', deps),
	component: ThemesPage,
});
