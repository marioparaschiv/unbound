import { IconCode } from 'nucleo-micro-bold';

import { searchDocs, type DocsSearchEntry } from '~/lib/docs/search';
import type { DocsSearchState } from '~/components/docs/docs-shell';
import SearchDialog from '~/components/docs/search-dialog';
import type { DocsRoute } from '~/lib/docs/docs-links';
import KindBadge from '~/components/docs/kind-badge';

type DocsSearchProps = DocsSearchState & {
	entries: DocsSearchEntry[];
	route: DocsRoute;
};

/**
 * @description The `⌘K` dialog of the SDK reference: searches every symbol and member of the version by name.
 * @param props The search entries, the version they belong to, and the open state.
 * @returns The dialog.
 */
function DocsSearch({ entries, route, ...state }: DocsSearchProps) {
	const memberCount = entries.filter((entry) => entry.kind === 'members').length;

	return (
		<SearchDialog
			{...state}
			id='docs-search-results'
			title='Search the docs'
			description='Type a symbol name; use the arrow keys and Enter to open it.'
			placeholder='Search functions, types and namespaces'
			search={(query) => searchDocs(entries, query)}
			getKey={(entry) => `${entry.kind}:${entry.qualifiedName}`}
			getLink={(entry) => ({
				to: '/docs/sdk/$version/$symbol',
				params: { version: route.version, symbol: entry.location.symbol },
				hash: entry.location.anchor,
			})}
			renderEntry={(entry) => (
				<>
					<KindBadge group={entry.kind} />
					<span className='font-medium font-mono'>{entry.name}</span>
					<span className='ml-auto font-mono text-muted-foreground text-xs single-line'>
						{entry.qualifiedName}
					</span>
				</>
			)}
			idleIcon={IconCode}
			idle={`${entries.length - memberCount} symbols and ${memberCount} members in this version.`}
		/>
	);
}

export default DocsSearch;
