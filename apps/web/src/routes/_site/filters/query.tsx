import { createFileRoute } from '@tanstack/react-router';

import PrototypeListing from '~/components/prototype/prototype-listing';
import QueryFilterBar from '~/components/prototype/query-filter-bar';
import { authorsQuery } from '~/queries/prototype/authors';

function QueryFiltersPage() {
	return (
		<PrototypeListing
			style='query'
			description='Type tag:, author: or updated: right in the search box.'
			FilterBar={QueryFilterBar}
		/>
	);
}

export const Route = createFileRoute('/_site/filters/query')({
	head: () => ({ meta: [{ title: 'Unbound | Filters prototype' }] }),
	// Not awaited: the page streams at once and the authors hydrate into the cache when they land.
	loader: ({ context }) => {
		void context.queryClient.prefetchInfiniteQuery(authorsQuery(''));
	},
	component: QueryFiltersPage,
});
