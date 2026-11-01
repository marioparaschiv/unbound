import { Link, useNavigate } from '@tanstack/react-router';
import { IconMagnifier } from 'nucleo-micro-bold';
import type { KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import { searchDocs, type DocsSearchEntry } from '~/lib/docs/search';
import type { DocsRoute } from '~/lib/docs/docs-links';
import KindBadge from '~/components/docs/kind-badge';
import cn from '~/lib/cn';

type DocsSearchProps = {
	entries: DocsSearchEntry[];
	route: DocsRoute;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const KEY_STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * @description The `⌘K` dialog: searches every symbol and member of the version by name, arrows move, Enter opens.
 * @param props The search entries, the version they belong to, and the open state.
 * @returns The dialog.
 */
function DocsSearch({ entries, route, open, onOpenChange }: DocsSearchProps) {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const results = useMemo(() => searchDocs(entries, query), [entries, query]);
	const memberCount = entries.filter((entry) => entry.kind === 'members').length;

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
		void navigate({
			to: '/docs/$package/$version/$symbol',
			params: { ...route, symbol: selected.location.symbol },
			hash: selected.location.anchor,
		});
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent
				showCloseButton={false}
				className='top-[18%] translate-y-0 gap-0 p-0 overflow-hidden sm:max-w-xl'
			>
				<DialogTitle className='sr-only'>Search the docs</DialogTitle>
				<DialogDescription className='sr-only'>
					Type a symbol name; use the arrow keys and Enter to open it.
				</DialogDescription>
				<label className='flex items-center gap-3 px-4 border-b h-14'>
					<IconMagnifier className='size-4 text-muted-foreground shrink-0' />
					<input
						autoFocus
						value={query}
						placeholder='Search functions, types and namespaces'
						aria-label='Search the docs'
						role='combobox'
						aria-expanded={results.length > 0}
						aria-controls='docs-search-results'
						className='flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-base'
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
					id='docs-search-results'
					role='listbox'
					className='p-1.5 max-h-96 overflow-y-auto'
				>
					{results.map((entry, index) => (
						<li
							key={`${entry.kind}:${entry.qualifiedName}`}
							role='option'
							aria-selected={index === active}
						>
							<Link
								to='/docs/$package/$version/$symbol'
								params={{ ...route, symbol: entry.location.symbol }}
								hash={entry.location.anchor}
								onClick={close}
								onMouseMove={() => setActive(index)}
								className={cn(
									'flex items-center gap-3 px-2.5 rounded-menu-item corner-continuous h-10 text-sm',
									index === active && 'bg-accent text-accent-foreground',
								)}
							>
								<KindBadge group={entry.kind} />
								<span className='font-medium font-mono'>{entry.name}</span>
								<span className='ml-auto font-mono text-muted-foreground text-xs single-line'>
									{entry.qualifiedName}
								</span>
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
						{entries.length - memberCount} symbols and {memberCount} members in this
						version.
					</p>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

export default DocsSearch;
