import { IconChevronDown, IconMagnifier, IconXmark } from 'nucleo-micro-bold';
import { useState } from 'react';

import {
	applyFilters,
	FIELDS,
	removeFilter,
	setFilterOperator,
	TAGS,
	toggleFilterValue,
	valueLabel,
} from '~/lib/prototype/addon-filters';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import type { FilterBarProps } from '~/components/prototype/prototype-listing';
import type { AddonFilter, FilterField } from '~/lib/prototype/addon-filters';
import { FieldIcon, TagDot } from '~/components/prototype/filter-parts';
import FilterMenu from '~/components/prototype/filter-menu';
import { buttonVariants } from '~/components/ui/button';
import cn from '~/lib/cn';

type FacetMenuProps = Pick<FilterBarProps, 'addons'> & {
	field: Exclude<FilterField, 'tag'>;
	filters: AddonFilter[];
	onChange: (filters: AddonFilter[]) => void;
};

/** A property button that reads "Author" at rest and "Author: Ana +1" once set, like Linear's view pills. */
function FacetMenu({ field, addons, filters, onChange }: FacetMenuProps) {
	const [open, setOpen] = useState(false);
	const definition = FIELDS[field];
	const filter = filters.find((candidate) => candidate.field === field);
	const [first, ...rest] = filter?.values ?? [];

	// The same menu style A uses, locked to one field: it pages authors and turns into a sheet on phones.
	return (
		<FilterMenu
			addons={addons}
			filters={filters}
			onChange={onChange}
			field={field}
			open={open}
			onOpenChange={setOpen}
			triggerLabel={definition.label}
			triggerClassName={cn(
				'inline-flex items-center gap-1.5 px-3 border rounded-full h-11 sm:h-8 text-sm transition-colors shrink-0',
				filter
					? 'bg-primary/10 border-primary/30 text-foreground'
					: 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
			)}
		>
			<FieldIcon field={field} />
			{definition.label}
			{first ? (
				<span className='font-medium'>
					{filter?.operator === 'none' ? 'not ' : ': '}
					{valueLabel(field, first)}
					{rest.length ? ` +${rest.length}` : null}
				</span>
			) : null}
			<IconChevronDown className='size-3 text-muted-foreground' />
		</FilterMenu>
	);
}

/** Every tag on show as a one-click pill with a live count, plus property menus for the rest. */
function FacetFilterBar({
	addons,
	results,
	filters,
	onFiltersChange,
	query,
	onQueryChange,
	sort,
}: FilterBarProps) {
	const tagFilter = filters.find((filter) => filter.field === 'tag');
	const picked = tagFilter?.values ?? [];
	// Counts are what each tag would add given every other filter, so a zero means a dead end.
	const pool = applyFilters(addons, removeFilter(filters, 'tag'), {
		q: query,
		sort: 'name',
	});

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-3'>
				<InputGroup className='w-full'>
					<InputGroupAddon>
						<IconMagnifier size={24} />
					</InputGroupAddon>
					<InputGroupInput
						className='h-full'
						placeholder='Search Plugins...'
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
					/>
				</InputGroup>
				{sort}
			</div>
			<div className='flex gap-1.5 -mx-1 px-1 pb-1 overflow-x-auto [scrollbar-width:none]'>
				{TAGS.map((tag) => {
					const on = picked.includes(tag.id);
					const count = pool.filter((addon) => addon.tags.includes(tag.id)).length;

					return (
						<button
							key={tag.id}
							type='button'
							aria-pressed={on}
							disabled={!on && count === 0}
							onClick={() =>
								onFiltersChange(toggleFilterValue(filters, 'tag', tag.id))
							}
							className={cn(
								'inline-flex items-center gap-1.5 px-3 border rounded-full h-11 sm:h-8 text-sm whitespace-nowrap transition-colors press-flat disabled:opacity-40 shrink-0',
								on
									? 'bg-foreground text-background border-foreground'
									: 'border-border hover:bg-accent',
							)}
						>
							<TagDot color={tag.color} />
							{tag.label}
							<span
								className={cn(
									'text-xs tabular-nums',
									on ? 'opacity-70' : 'text-muted-foreground',
								)}
							>
								{count}
							</span>
						</button>
					);
				})}
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<FacetMenu
					field='author'
					addons={addons}
					filters={filters}
					onChange={onFiltersChange}
				/>
				<FacetMenu
					field='updated'
					addons={addons}
					filters={filters}
					onChange={onFiltersChange}
				/>
				{picked.length > 1 ? (
					<div className='flex items-center gap-0.5 p-0.5 border border-border rounded-full h-11 sm:h-8 text-sm'>
						{(['any', 'all'] as const).map((operator) => (
							<button
								key={operator}
								type='button'
								onClick={() =>
									onFiltersChange(setFilterOperator(filters, 'tag', operator))
								}
								className={cn(
									'px-2.5 rounded-full h-full',
									tagFilter?.operator === operator
										? 'bg-accent font-medium'
										: 'text-muted-foreground',
								)}
							>
								Match {operator}
							</button>
						))}
					</div>
				) : null}
				<span className='ml-auto text-muted-foreground text-sm tabular-nums'>
					{results.length} plugins
				</span>
				{filters.length > 0 ? (
					<button
						type='button'
						onClick={() => onFiltersChange([])}
						className={cn(
							buttonVariants({ variant: 'ghost', size: 'sm' }),
							'h-11 sm:h-8',
						)}
					>
						<IconXmark className='size-3.5' />
						Clear
					</button>
				) : null}
			</div>
		</div>
	);
}

export default FacetFilterBar;
