import { createFileRoute } from '@tanstack/react-router';

import PrototypeListing from '~/components/prototype/prototype-listing';
import FacetFilterBar from '~/components/prototype/facet-filter-bar';
import { authorsQuery } from '~/queries/prototype/authors';

function FacetsFiltersPage() {
	return (
		<PrototypeListing
			style='facets'
			description='Every tag one click away, with live counts.'
			FilterBar={FacetFilterBar}
		/>
	);
}

export const Route = createFileRoute('/_site/filters/facets')({
	head: () => ({ meta: [{ title: 'Unbound | Filters prototype' }] }),
	// Not awaited: the page streams at once and the authors hydrate into the cache when they land.
	loader: ({ context }) => {
		void context.queryClient.prefetchInfiniteQuery(authorsQuery(''));
	},
	component: FacetsFiltersPage,
});
