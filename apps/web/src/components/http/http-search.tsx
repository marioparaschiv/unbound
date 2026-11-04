import { IconBooks, IconFileSearch, IconMagnifier } from 'nucleo-micro-bold';
import { Link, useNavigate } from '@tanstack/react-router';
import type { KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import type { DocsSearchState } from '~/components/docs/docs-shell';
import type { HttpOperationEntry } from '~/lib/docs/http-reference';
import SearchEmpty from '~/components/docs/search-empty';
import MethodBadge from '~/components/http/method-badge';
import Kbd from '~/components/ui/kbd';
import cn from '~/lib/cn';

type HttpSearchProps = DocsSearchState & {
	operations: HttpOperationEntry[];
};

const KEY_STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

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
 * @description The `⌘K` dialog of the HTTP reference: searches operation summaries, methods and paths,
 * arrows move, Enter jumps to the section.
 * @param props The operations and the open state.
 * @returns The dialog.
 */
function HttpSearch({ operations, open, onOpenChange }: HttpSearchProps) {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const results = useMemo(() => searchOperations(operations, query), [operations, query]);
	const [shownOpen, setShownOpen] = useState(open);

	// Clears the query on every close, including the `⌘K` toggle the shell owns.
	if (open !== shownOpen) {
		setShownOpen(open);

		if (!open) {
			setQuery('');
			setActive(0);
		}
	}

	function close() {
		onOpenChange(false);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		const step = KEY_STEPS[event.key];

		if (step !== undefined && results.length) {
			event.preventDefault();
			setActive((index) => (index + step + results.length) % results.length);

			return;
		}

		const selected = results[active];

		if (!(event.key === 'Enter' && selected)) {
			return;
		}

		event.preventDefault();
		close();
		void navigate({ to: '/docs/http', hash: selected.anchor });
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent
				showCloseButton={false}
				className='top-[18%] translate-y-0 gap-0 p-0 overflow-hidden sm:max-w-xl'
			>
				<DialogTitle className='sr-only'>Search the HTTP reference</DialogTitle>
				<DialogDescription className='sr-only'>
					Type an operation or a path; use the arrow keys and Enter to open it.
				</DialogDescription>
				<label className='flex items-center gap-3 px-4 border-b h-14'>
					<IconMagnifier className='size-4 text-muted-foreground shrink-0' />
					<input
						autoFocus
						value={query}
						placeholder='Search operations and paths'
						aria-label='Search the HTTP reference'
						role='combobox'
						aria-expanded={results.length > 0}
						aria-controls='http-search-results'
						className='flex-1 bg-transparent outline-none min-w-0 placeholder:text-muted-foreground text-base'
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					<Kbd>Esc</Kbd>
				</label>
				<ul
					id='http-search-results'
					role='listbox'
					className='p-1.5 max-h-96 overflow-y-auto empty:hidden'
				>
					{results.map((entry, index) => (
						<li key={entry.anchor} role='option' aria-selected={index === active}>
							<Link
								to='/docs/http'
								hash={entry.anchor}
								onClick={close}
								onMouseMove={() => setActive(index)}
								className={cn(
									'flex items-center gap-3 px-2.5 rounded-menu-item corner-continuous h-10 text-sm',
									index === active && 'bg-accent text-accent-foreground',
								)}
							>
								<MethodBadge method={entry.method} />
								<span className='font-medium single-line'>
									{entry.operation.summary}
								</span>
								<span className='hidden sm:block ml-auto font-mono text-muted-foreground text-xs single-line shrink-0'>
									{entry.path}
								</span>
							</Link>
						</li>
					))}
				</ul>
				{query.trim() && !results.length ? (
					<SearchEmpty icon={IconFileSearch}>
						Nothing matches “{query.trim()}”.
					</SearchEmpty>
				) : null}
				{!query.trim() ? (
					<SearchEmpty icon={IconBooks}>
						Search {operations.length} operations.
					</SearchEmpty>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

export default HttpSearch;
