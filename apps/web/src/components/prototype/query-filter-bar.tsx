import { IconMagnifier, IconXmark } from 'nucleo-micro-bold';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

import {
	FIELD_ORDER,
	FIELDS,
	operatorLabel,
	removeFilter,
	setFilterOperator,
	toggleFilterValue,
	valueLabel,
} from '~/lib/prototype/addon-filters';
import type { FilterBarProps } from '~/components/prototype/prototype-listing';
import type { AddonFilter, FilterField } from '~/lib/prototype/addon-filters';
import { FieldIcon, OptionMark } from '~/components/prototype/filter-parts';
import cn from '~/lib/cn';

type Suggestion = {
	key: string;
	field: FilterField;
	/** `null` completes the field name (`tag:`) instead of adding a value. */
	value: string | null;
	label: string;
	count?: number;
	checked?: boolean;
};

const KEYWORDS: Record<FilterField, string> = { tag: 'tag', author: 'author', updated: 'updated' };

/** Parses `tag:app` into the field being typed and the text after the colon. */
function parseToken(text: string) {
	const match = /^(\w+):(.*)$/.exec(text);
	const field = FIELD_ORDER.find(
		(candidate) => KEYWORDS[candidate] === match?.[1]?.toLowerCase(),
	);

	return field && match ? { field, rest: match[2]?.toLowerCase() ?? '' } : null;
}

function nextOperator(filter: AddonFilter) {
	const operators = FIELDS[filter.field].operators;

	return operators[(operators.indexOf(filter.operator) + 1) % operators.length] ?? 'any';
}

/** GitHub-style: filters are typed as `field:value` tokens and live as chips inside the search box. */
function QueryFilterBar({
	addons,
	results,
	filters,
	onFiltersChange,
	query: search,
	onQueryChange,
	sort,
}: FilterBarProps) {
	const [focused, setFocused] = useState(false);
	const [active, setActive] = useState(0);
	const input = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState(search);
	const token = parseToken(query);

	// A half-typed `tag:vo` is a filter in progress, not text to search for.
	function changeQuery(next: string) {
		setQuery(next);
		onQueryChange(parseToken(next) ? '' : next);
	}

	function valueSuggestions(field: FilterField, needle: string): Suggestion[] {
		const picked = filters.find((filter) => filter.field === field)?.values ?? [];

		return FIELDS[field]
			.options(addons)
			.filter((option) => option.label.toLowerCase().includes(needle))
			.map((option) => ({
				key: `${field}:${option.value}`,
				field,
				value: option.value,
				label: option.label,
				count: option.count,
				checked: picked.includes(option.value),
			}));
	}

	const fieldSuggestions: Suggestion[] = FIELD_ORDER.filter((field) =>
		KEYWORDS[field].startsWith(query.toLowerCase()),
	).map((field) => ({ key: field, field, value: null, label: `${KEYWORDS[field]}:` }));

	// A bare word also offers the tags it matches, so "priv" finds the Privacy tag without "tag:".
	const suggestions = token
		? valueSuggestions(token.field, token.rest)
		: query
			? [...fieldSuggestions, ...valueSuggestions('tag', query.toLowerCase())].slice(0, 8)
			: fieldSuggestions;
	const current = Math.min(active, Math.max(suggestions.length - 1, 0));

	function pick(suggestion: Suggestion) {
		setActive(0);

		if (suggestion.value === null) {
			changeQuery(`${KEYWORDS[suggestion.field]}:`);
			input.current?.focus();

			return;
		}

		onFiltersChange(toggleFilterValue(filters, suggestion.field, suggestion.value));
		changeQuery('');
		input.current?.focus();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;

			setActive((current + step + suggestions.length) % Math.max(suggestions.length, 1));

			return;
		}

		if (
			(event.key === 'Enter' || event.key === 'Tab') &&
			(token || query === '') &&
			suggestions[current]
		) {
			event.preventDefault();
			pick(suggestions[current]);

			return;
		}

		if (event.key === 'Escape') {
			input.current?.blur();

			return;
		}

		const last = filters.at(-1);

		if (!(event.key === 'Backspace' && query === '' && last)) {
			return;
		}

		event.preventDefault();
		onFiltersChange(toggleFilterValue(filters, last.field, last.values.at(-1) ?? ''));
	}

	return (
		<div className='flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-3'>
			<div className='relative w-full'>
				<div
					onClick={() => input.current?.focus()}
					className={cn(
						'flex flex-wrap items-center gap-1.5 px-3 py-1.5 min-h-11 cursor-text field',
						focused ? 'ring-[3px] ring-halo' : null,
					)}
				>
					<IconMagnifier className='mr-0.5 size-4 text-muted-foreground' />
					{filters.map((filter) => (
						<span
							key={filter.field}
							className='inline-flex items-center gap-1 bg-accent pr-1 pl-2 rounded-item corner-continuous h-7 max-sm:h-9 text-sm animate-reveal'
						>
							<FieldIcon field={filter.field} />
							<span className='font-medium'>{KEYWORDS[filter.field]}</span>
							<button
								type='button'
								title='Click to change how this compares'
								onClick={(event) => {
									event.stopPropagation();
									onFiltersChange(
										setFilterOperator(
											filters,
											filter.field,
											nextOperator(filter),
										),
									);
								}}
								className='hover:bg-background/60 px-1 rounded text-muted-foreground'
							>
								{operatorLabel(filter)}
							</button>
							<span className='font-medium'>
								{filter.values
									.map((value) => valueLabel(filter.field, value))
									.join(', ')}
							</span>
							<button
								type='button'
								aria-label={`Remove the ${FIELDS[filter.field].label} filter`}
								onClick={(event) => {
									event.stopPropagation();
									onFiltersChange(removeFilter(filters, filter.field));
								}}
								className='flex justify-center items-center hover:bg-background/60 rounded size-5 max-sm:size-8 text-muted-foreground'
							>
								<IconXmark className='size-3' />
							</button>
						</span>
					))}
					<input
						ref={input}
						value={query}
						placeholder={
							filters.length
								? 'Add filters or search...'
								: 'Search, or type tag: author: updated:'
						}
						onFocus={() => setFocused(true)}
						onBlur={() => setFocused(false)}
						onChange={(event) => {
							changeQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={handleKeyDown}
						className='flex-1 bg-transparent py-1 min-w-40 outline-none text-sm max-sm:text-base placeholder:text-muted-foreground'
					/>
					<span className='text-muted-foreground text-xs tabular-nums'>
						{results.length}
					</span>
				</div>
				{focused && suggestions.length > 0 ? (
					<div className='top-full z-50 absolute inset-x-0 flex flex-col bg-popover shadow-float mt-1 p-1.5 border border-border rounded-menu corner-continuous animate-reveal'>
						<div className='px-2 py-1 text-muted-foreground text-xs'>
							{token
								? FIELDS[token.field].label
								: query
									? 'Filters and tags'
									: 'Filter by'}
						</div>
						{suggestions.map((suggestion, index) => (
							<button
								key={suggestion.key}
								type='button'
								data-active={index === current}
								onMouseDown={(event) => event.preventDefault()}
								onMouseMove={() => setActive(index)}
								onClick={() => pick(suggestion)}
								className='flex items-center gap-2 data-[active=true]:bg-accent px-2 py-1.5 max-sm:py-3 rounded-menu-item corner-continuous text-sm max-sm:text-base text-left cursor-default'
							>
								{suggestion.value === null ? (
									<FieldIcon field={suggestion.field} />
								) : (
									<OptionMark
										field={suggestion.field}
										option={
											FIELDS[suggestion.field]
												.options(addons)
												.find(
													(option) => option.value === suggestion.value,
												) ?? {
												color: null,
												avatarUrl: null,
												label: suggestion.label,
											}
										}
									/>
								)}
								<span
									className={cn(
										'flex-1',
										suggestion.value === null ? 'font-mono' : null,
									)}
								>
									{suggestion.label}
								</span>
								{suggestion.checked ? (
									<span className='text-primary text-xs'>added</span>
								) : null}
								{suggestion.count === undefined ? null : (
									<span className='text-muted-foreground text-xs tabular-nums'>
										{suggestion.count}
									</span>
								)}
							</button>
						))}
						<div className='flex gap-3 mt-1 px-2 pt-1.5 pb-0.5 border-t border-border text-[11px] text-muted-foreground'>
							<span>↑↓ navigate</span>
							<span>↵ add</span>
							<span>⌫ remove last</span>
						</div>
					</div>
				) : null}
			</div>
			{sort}
		</div>
	);
}

export default QueryFilterBar;
