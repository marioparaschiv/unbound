import { IconBarsFilter, IconMagnifier, IconPlus, IconXmark } from 'nucleo-micro-bold';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
	authorOptions,
	FIELDS,
	operatorLabel,
	removeFilter,
	setFilterOperator,
	tagOptions,
	UPDATED_WINDOWS,
	windowLabel,
	type AddonFilter,
	type FilterOption,
} from '~/lib/addon-filters';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { FieldIcon, OptionMark } from '~/components/addon-filters/filter-parts';
import { pickedAuthorsQuery } from '~/queries/marketplace/authors';
import FilterMenu from '~/components/addon-filters/filter-menu';
import { tagsQuery } from '~/queries/marketplace/tags';
import { buttonVariants } from '~/components/ui/button';
import cn from '~/lib/cn';

type FilterBarProps = {
	type: AddonType;
	filters: AddonFilter[];
	onFiltersChange: (filters: AddonFilter[]) => void;
	query: string;
	onQueryChange: (query: string) => void;
	placeholder: string;
	/** The controls after the Filter button, such as the sort menu. */
	actions: ReactNode;
};

type FilterChipProps = {
	type: AddonType;
	filter: AddonFilter;
	filters: AddonFilter[];
	onChange: (filters: AddonFilter[]) => void;
};

type ValueSummaryProps = Pick<FilterChipProps, 'type' | 'filter'>;

const SEGMENT =
	'flex items-center gap-1.5 px-2 h-full hover:bg-accent transition-colors outline-none';

// The picked values' rows, read from the caches the menu fills; a value not loaded yet shows its id.
function usePickedOptions({ type, filter }: ValueSummaryProps): FilterOption[] {
	const tags = useQuery({ ...tagsQuery(type), select: tagOptions });
	const authors = useQuery({
		...pickedAuthorsQuery(filter.field === 'author' ? filter.values : []),
		enabled: filter.field === 'author',
		select: authorOptions,
		placeholderData: keepPreviousData,
	});
	const known = { tag: tags.data, author: authors.data, updated: UPDATED_WINDOWS }[filter.field];

	return filter.values.map(
		(value) =>
			known?.find((option) => option.value === value) ?? {
				value,
				label: filter.field === 'updated' ? windowLabel(value) : value,
				color: null,
				avatarUrl: null,
			},
	);
}

function ValueSummary({ type, filter }: ValueSummaryProps) {
	const options = usePickedOptions({ type, filter });

	return (
		<>
			<span className='flex -space-x-0.5'>
				{options.slice(0, 3).map((option) => (
					<OptionMark key={option.value} field={filter.field} option={option} />
				))}
			</span>
			<span>
				{options.length > 2
					? `${options.length} ${FIELDS[filter.field].plural}`
					: options.map((option) => option.label).join(', ')}
			</span>
		</>
	);
}

/** One condition as Linear draws it: field, operator, values and a remove button, each its own hit target. */
function FilterChip({ type, filter, filters, onChange }: FilterChipProps) {
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
						onValueChange={(next) => {
							const operator = field.operators.find(
								(candidate) => candidate === next,
							);

							if (operator) {
								onChange(setFilterOperator(filters, filter.field, operator));
							}
						}}
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
				type={type}
				filters={filters}
				onChange={onChange}
				field={filter.field}
				open={open}
				onOpenChange={setOpen}
				triggerClassName={cn(SEGMENT, 'font-medium')}
				triggerLabel={`Edit ${field.label}`}
			>
				<ValueSummary type={type} filter={filter} />
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

/**
 * @description The listing's search field, Linear-style Filter menu and condition chips; F opens the menu.
 * @param props The listing type, the filters, the search text and the controls beside the Filter button.
 * @returns The bar.
 */
function FilterBar({
	type,
	filters,
	onFiltersChange,
	query,
	onQueryChange,
	placeholder,
	actions,
}: FilterBarProps) {
	const [menuOpen, setMenuOpen] = useState(false);

	// Linear opens the filter menu on F from anywhere outside a text field.
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target;

			if (event.key !== 'f' || event.metaKey || event.ctrlKey || event.altKey) return;

			if (target instanceof Element && target.closest('input, textarea, [contenteditable]')) {
				return;
			}

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
						placeholder={placeholder}
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
					/>
				</InputGroup>
				<FilterMenu
					type={type}
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
				{actions}
			</div>
			{filters.length > 0 ? (
				<div className='flex flex-wrap items-center gap-2'>
					{filters.map((filter) => (
						<FilterChip
							key={filter.field}
							type={type}
							filter={filter}
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
					<button
						type='button'
						onClick={() => onFiltersChange([])}
						className='ml-auto font-medium text-muted-foreground hover:text-foreground text-sm'
					>
						Clear
					</button>
				</div>
			) : null}
		</div>
	);
}

export default FilterBar;
