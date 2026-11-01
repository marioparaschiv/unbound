import { IconHashtag, IconMagnifier, IconNote } from 'nucleo-micro-bold';
import { Link, useNavigate } from '@tanstack/react-router';
import type { KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import { searchGuides, type GuideSearchEntry } from '~/lib/guides/guide-search';
import type { DocsSearchState } from '~/components/docs/docs-shell';
import type { GuideTab } from '~/lib/guides/guide-nav';
import { getGuidePath } from '~/lib/guides/guides';
import cn from '~/lib/cn';

type GuideSearchProps = DocsSearchState & {
	tab: GuideTab;
	entries: GuideSearchEntry[];
};

const KEY_STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * @description The `⌘K` dialog of a guide tab: searches page titles and headings, arrows move, Enter opens.
 * @param props The tab, its search entries and the open state.
 * @returns The dialog.
 */
function GuideSearch({ tab, entries, open, onOpenChange }: GuideSearchProps) {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const results = useMemo(() => searchGuides(entries, query), [entries, query]);

	function close() {
		onOpenChange(false);
		setQuery('');
		setActive(0);
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
		void navigate({ to: getGuidePath({ tab, slug: selected.slug }), hash: selected.anchor });
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent
				showCloseButton={false}
				className='top-[18%] translate-y-0 gap-0 p-0 overflow-hidden sm:max-w-xl'
			>
				<DialogTitle className='sr-only'>Search the guides</DialogTitle>
				<DialogDescription className='sr-only'>
					Type a page or heading; use the arrow keys and Enter to open it.
				</DialogDescription>
				<label className='flex items-center gap-3 px-4 border-b h-14'>
					<IconMagnifier className='size-4 text-muted-foreground shrink-0' />
					<input
						autoFocus
						value={query}
						placeholder='Search pages and headings'
						aria-label='Search the guides'
						role='combobox'
						aria-expanded={results.length > 0}
						aria-controls='guide-search-results'
						className='flex-1 bg-transparent outline-none min-w-0 placeholder:text-muted-foreground text-base'
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					<kbd className='px-1.5 py-0.5 border rounded-md font-mono text-[11px] text-muted-foreground'>
						Esc
					</kbd>
				</label>
				<ul
					id='guide-search-results'
					role='listbox'
					className='p-1.5 max-h-96 overflow-y-auto'
				>
					{results.map((entry, index) => (
						<li
							key={`${entry.slug}#${entry.anchor ?? ''}`}
							role='option'
							aria-selected={index === active}
						>
							<Link
								to={getGuidePath({ tab, slug: entry.slug })}
								hash={entry.anchor}
								onClick={close}
								onMouseMove={() => setActive(index)}
								className={cn(
									'flex items-center gap-3 px-2.5 rounded-menu-item corner-continuous h-10 text-sm',
									index === active && 'bg-accent text-accent-foreground',
								)}
							>
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
							</Link>
						</li>
					))}
				</ul>
				{query.trim() && !results.length ? (
					<p className='px-4 pb-6 text-muted-foreground text-sm text-center'>
						Nothing matches “{query.trim()}”.
					</p>
				) : null}
				{!query.trim() ? (
					<p className='px-4 pb-6 text-muted-foreground text-sm text-center'>
						Search {entries.filter((entry) => !entry.anchor).length} pages and their
						headings.
					</p>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

export default GuideSearch;
