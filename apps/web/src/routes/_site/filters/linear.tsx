import { createFileRoute } from '@tanstack/react-router';

import PrototypeListing from '~/components/prototype/prototype-listing';
import LinearFilterBar from '~/components/prototype/linear-filter-bar';
import { authorsQuery } from '~/queries/prototype/authors';

function LinearFiltersPage() {
	return (
		<PrototypeListing
			style='linear'
			description='Filter menu with Linear-style condition chips. Press F to open.'
			FilterBar={LinearFilterBar}
		/>
	);
}

export const Route = createFileRoute('/_site/filters/linear')({
	head: () => ({ meta: [{ title: 'Unbound | Filters prototype' }] }),
	// Not awaited: the page streams at once and the authors hydrate into the cache when they land.
	loader: ({ context }) => {
		void context.queryClient.prefetchInfiniteQuery(authorsQuery(''));
	},
	component: LinearFiltersPage,
});
