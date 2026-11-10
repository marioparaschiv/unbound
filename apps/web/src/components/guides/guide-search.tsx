import { IconBooks, IconHashtag, IconNote } from 'nucleo-micro-bold';

import { searchGuides, type GuideSearchEntry } from '~/lib/guides/guide-search';
import type { DocsSearchState } from '~/components/docs/docs-shell';
import SearchDialog from '~/components/docs/search-dialog';
import type { GuideTab } from '~/lib/guides/guide-nav';
import { getGuidePath } from '~/lib/guides/guides';

type GuideSearchProps = DocsSearchState & {
	tab: GuideTab;
	entries: GuideSearchEntry[];
};

/**
 * @description The `⌘K` dialog of a guide tab: searches page titles and headings.
 * @param props The tab, its search entries and the open state.
 * @returns The dialog.
 */
function GuideSearch({ tab, entries, ...state }: GuideSearchProps) {
	return (
		<SearchDialog
			{...state}
			id='guide-search-results'
			title='Search the guides'
			description='Type a page or heading; use the arrow keys and Enter to open it.'
			placeholder='Search pages and headings'
			search={(query) => searchGuides(entries, query)}
			getKey={(entry) => `${entry.slug}#${entry.anchor ?? ''}`}
			getLink={(entry) => ({
				to: getGuidePath({ tab, slug: entry.slug }),
				hash: entry.anchor,
			})}
			renderEntry={(entry) => (
				<>
					{entry.anchor ? (
						<IconHashtag className='size-4 text-muted-foreground shrink-0' />
					) : (
						<IconNote className='size-4 text-muted-foreground shrink-0' />
					)}
					<span className='font-medium single-line'>{entry.text}</span>
					{entry.anchor ? (
						<span className='hidden sm:block ml-auto text-muted-foreground text-xs single-line shrink-0'>
							{entry.page}
						</span>
					) : null}
				</>
			)}
			idleIcon={IconBooks}
			idle={`Search ${entries.filter((entry) => !entry.anchor).length} pages and their headings.`}
		/>
	);
}

export default GuideSearch;
