import { IconBarsFilter, IconMagnifier, IconPlus, IconXmark } from 'nucleo-micro-bold';
import { useEffect, useState } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
	FIELDS,
	operatorLabel,
	removeFilter,
	setFilterOperator,
	valueLabel,
} from '~/lib/prototype/addon-filters';
import type { AddonFilter, FilterOperator, TaggedAddon } from '~/lib/prototype/addon-filters';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import type { FilterBarProps } from '~/components/prototype/prototype-listing';
import { FieldIcon, OptionMark } from '~/components/prototype/filter-parts';
import FilterMenu from '~/components/prototype/filter-menu';
import { buttonVariants } from '~/components/ui/button';
import cn from '~/lib/cn';

type FilterChipProps = {
	filter: AddonFilter;
	addons: TaggedAddon[];
	filters: AddonFilter[];
	onChange: (filters: AddonFilter[]) => void;
};

const SEGMENT =
	'flex items-center gap-1.5 px-2 h-full hover:bg-accent transition-colors outline-none';

function ValueSummary({ filter, addons }: Pick<FilterChipProps, 'filter' | 'addons'>) {
	const options = FIELDS[filter.field]
		.options(addons)
		.filter((option) => filter.values.includes(option.value));

	return (
		<>
			<span className='flex -space-x-0.5'>
				{options.slice(0, 3).map((option) => (
					<OptionMark key={option.value} field={filter.field} option={option} />
				))}
			</span>
			<span>
				{filter.values.length > 2
					? `${filter.values.length} ${FIELDS[filter.field].plural}`
					: filter.values.map((value) => valueLabel(filter.field, value)).join(', ')}
			</span>
		</>
	);
}

/** One condition as Linear draws it: field, operator, values and a remove button, each its own hit target. */
function FilterChip({ filter, addons, filters, onChange }: FilterChipProps) {
	const [open, setOpen] = useState(false);
	const field = FIELDS[filter.field];

	return (
		<div className='flex items-center bg-card border border-border rounded-control h-11 sm:h-8 overflow-hidden text-sm divide-x divide-border animate-reveal'>
			<span className='flex items-center gap-1.5 px-2 h-full font-medium'>
				<FieldIcon field={filter.field} />
				{field.label}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger className={cn(SEGMENT, 'text-muted-foreground')}>
					{operatorLabel(filter)}
				</DropdownMenuTrigger>
				<DropdownMenuContent align='start'>
					<DropdownMenuRadioGroup
						value={filter.operator}
						onValueChange={(operator) =>
							onChange(
								setFilterOperator(
									filters,
									filter.field,
									operator as FilterOperator,
								),
							)
						}
					>
						{field.operators.map((operator) => (
							<DropdownMenuRadioItem key={operator} value={operator}>
								{operatorLabel({ ...filter, operator })}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<FilterMenu
				addons={addons}
				filters={filters}
				onChange={onChange}
				field={filter.field}
				open={open}
				onOpenChange={setOpen}
				triggerClassName={cn(SEGMENT, 'font-medium')}
				triggerLabel={`Edit ${field.label}`}
			>
				<ValueSummary filter={filter} addons={addons} />
			</FilterMenu>
			<button
				type='button'
				aria-label={`Remove the ${field.label} filter`}
				onClick={() => onChange(removeFilter(filters, filter.field))}
				className={cn(SEGMENT, 'text-muted-foreground hover:text-foreground')}
			>
				<IconXmark className='size-3.5' />
			</button>
		</div>
	);
}

function LinearFilterBar({
	addons,
	results,
	filters,
	onFiltersChange,
	query,
	onQueryChange,
	sort,
}: FilterBarProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	// Linear opens the filter menu on F from anywhere outside a text field.
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target as HTMLElement;

			if (event.key !== 'f' || event.metaKey || event.ctrlKey) return;

			if (target.closest('input, textarea, [contenteditable]')) return;

			event.preventDefault();
			setMenuOpen(true);
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

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
				<FilterMenu
					addons={addons}
					filters={filters}
					onChange={onFiltersChange}
					open={menuOpen}
					onOpenChange={setMenuOpen}
					triggerClassName={cn(
						buttonVariants({ variant: 'outline' }),
						'flex-1 sm:flex-none min-w-23',
					)}
					triggerLabel='Filter'
				>
					<IconBarsFilter size={24} />
					<span>Filter</span>
					<kbd className='hidden sm:inline px-1.5 border border-border rounded font-mono text-[10px] text-muted-foreground'>
						F
					</kbd>
				</FilterMenu>
				{sort}
			</div>
			{filters.length > 0 ? (
				<div className='flex flex-wrap items-center gap-2'>
					{filters.map((filter) => (
						<FilterChip
							key={filter.field}
							filter={filter}
							addons={addons}
							filters={filters}
							onChange={onFiltersChange}
						/>
					))}
					<button
						type='button'
						aria-label='Add filter'
						onClick={() => setMenuOpen(true)}
						className='flex justify-center items-center hover:bg-accent border border-border border-dashed rounded-control size-11 sm:size-8 text-muted-foreground'
					>
						<IconPlus className='size-3.5' />
					</button>
					<span className='ml-auto text-muted-foreground text-sm tabular-nums'>
						{results.length} of {addons.length}
					</span>
					<button
						type='button'
						onClick={() => onFiltersChange([])}
						className='font-medium text-muted-foreground hover:text-foreground text-sm'
					>
						Clear
					</button>
				</div>
			) : null}
		</div>
	);
}

export default LinearFilterBar;
