import { Link, useNavigate, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router';
import type { ComponentType, KeyboardEvent, ReactNode } from 'react';
import { IconFileSearch, IconMagnifier } from 'nucleo-micro-bold';
import { useMemo, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/components/ui/dialog';
import type { DocsSearchState } from '~/components/docs/docs-shell';
import SearchEmpty from '~/components/docs/search-empty';
import Kbd from '~/components/ui/kbd';
import cn from '~/lib/cn';

// Widened to any path: guide links are built at runtime as strings.
type SearchLink = LinkOptions<RegisteredRouter, string, string>;

type IconProps = {
	className?: string;
};

type SearchDialogProps<T> = DocsSearchState & {
	id: string;
	title: string;
	description: string;
	placeholder: string;
	search: (query: string) => T[];
	getKey: (entry: T) => string;
	getLink: (entry: T) => SearchLink;
	renderEntry: (entry: T) => ReactNode;
	idleIcon: ComponentType<IconProps>;
	idle: ReactNode;
};

const KEY_STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * @description The `⌘K` dialog every docs tab shares: a query field, arrows move through the results, Enter opens one.
 * @template T The search entry.
 * @param props The open state, the copy, how to search and how to show and link an entry.
 * @returns The dialog.
 */
function SearchDialog<T>({
	id,
	title,
	description,
	placeholder,
	search,
	getKey,
	getLink,
	renderEntry,
	idleIcon,
	idle,
	open,
	onOpenChange,
}: SearchDialogProps<T>) {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [active, setActive] = useState(0);
	const results = useMemo(() => search(query), [search, query]);
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
		void navigate(getLink(selected));
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			{/* The menu radius keeps the rows concentric: `rounded-menu-item` is it minus the list's `p-1.5`. */}
			<DialogContent
				showCloseButton={false}
				className='top-[18%] translate-y-0 gap-0 p-0 overflow-hidden rounded-menu corner-continuous sm:max-w-xl'
			>
				<DialogTitle className='sr-only'>{title}</DialogTitle>
				<DialogDescription className='sr-only'>{description}</DialogDescription>
				<label className='flex items-center gap-3 px-4 border-b h-14'>
					<IconMagnifier className='size-4 text-muted-foreground shrink-0' />
					<input
						autoFocus
						value={query}
						placeholder={placeholder}
						aria-label={title}
						role='combobox'
						aria-expanded={results.length > 0}
						aria-controls={id}
						className='flex-1 bg-transparent outline-none min-w-0 placeholder:text-muted-foreground text-base'
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					<Kbd>Esc</Kbd>
				</label>
				<ul id={id} role='listbox' className='p-1.5 max-h-96 overflow-y-auto empty:hidden'>
					{results.map((entry, index) => (
						<li key={getKey(entry)} role='option' aria-selected={index === active}>
							<Link
								{...getLink(entry)}
								onClick={close}
								onMouseMove={() => setActive(index)}
								className={cn(
									'flex items-center gap-3 px-2.5 rounded-menu-item corner-continuous h-10 text-sm',
									index === active && 'bg-accent text-accent-foreground',
								)}
							>
								{renderEntry(entry)}
							</Link>
						</li>
					))}
				</ul>
				{query.trim() && !results.length ? (
					<SearchEmpty icon={IconFileSearch}>
						Nothing matches “{query.trim()}”.
					</SearchEmpty>
				) : null}
				{!query.trim() ? <SearchEmpty icon={idleIcon}>{idle}</SearchEmpty> : null}
			</DialogContent>
		</Dialog>
	);
}

export default SearchDialog;
