import { IconBooks } from 'nucleo-micro-bold';

import type { DocsSearchState } from '~/components/docs/docs-shell';
import type { HttpOperationEntry } from '~/lib/docs/http-reference';
import SearchDialog from '~/components/docs/search-dialog';
import MethodBadge from '~/components/http/method-badge';

type HttpSearchProps = DocsSearchState & {
	operations: HttpOperationEntry[];
};

function searchOperations(operations: HttpOperationEntry[], query: string): HttpOperationEntry[] {
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return [];
	}

	return operations.filter((entry) =>
		`${entry.operation.summary} ${entry.method} ${entry.path}`.toLowerCase().includes(needle),
	);
}

/**
 * @description The `⌘K` dialog of the HTTP reference: searches operation summaries, methods and paths.
 * @param props The operations and the open state.
 * @returns The dialog.
 */
function HttpSearch({ operations, ...state }: HttpSearchProps) {
	return (
		<SearchDialog
			{...state}
			id='http-search-results'
			title='Search the HTTP reference'
			description='Type an operation or a path; use the arrow keys and Enter to open it.'
			placeholder='Search operations and paths'
			search={(query) => searchOperations(operations, query)}
			getKey={(entry) => entry.anchor}
			getLink={(entry) => ({ to: '/docs/api', hash: entry.anchor })}
			renderEntry={(entry) => (
				<>
					<MethodBadge method={entry.method} />
					<span className='font-medium single-line'>{entry.operation.summary}</span>
					<span className='hidden sm:block ml-auto font-mono text-muted-foreground text-xs single-line shrink-0'>
						{entry.path}
					</span>
				</>
			)}
			idleIcon={IconBooks}
			idle={`Search ${operations.length} operations.`}
		/>
	);
}

export default HttpSearch;
