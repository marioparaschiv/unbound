import type { AdminAddonStatus, AdminAddonsSearch } from '@unbound-app/contracts/admin';
import { IconSortAscending, IconSortDescending, IconX } from '@tabler/icons-react';
import type { UserSummary } from '@unbound-app/contracts/account';
import type { AddonType } from '@unbound-app/contracts/addons';
import type { ReactNode } from 'react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import { formatCalendarDate, parseCalendarDate } from '~/lib/calendar-date';
import UserSearch from '~/components/admin/user-search';
import DatePicker from '~/components/ui/date-picker';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Label from '~/components/ui/label';
import cn from '~/lib/cn';

/** The admin addons list's URL search without its paging, which every filter change resets. */
type AddonFilterValues = Omit<AdminAddonsSearch, 'q' | 'cursor' | 'dir'>;

type AddonFiltersProps = {
	filters: AddonFilterValues;
	/** The user the `maintainer` filter names, or `null` when unset or unknown. */
	maintainer: UserSummary | null;
	/** Receives the changed filters; an `undefined` value removes that filter. */
	onChange: (filters: AddonFilterValues) => void;
};

type FilterFieldProps = {
	id: string;
	label: string;
	children: ReactNode;
};

type FilterSelectProps<T extends string> = {
	id: string;
	value: T | undefined;
	options: Record<T, string>;
	allLabel: string;
	className?: string;
	onChange: (value: T | undefined) => void;
};

type MaintainerPickerProps = {
	id: string;
	selected: string | undefined;
	maintainer: UserSummary | null;
	onChange: (id: string | undefined) => void;
};

const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugins',
	theme: 'Themes',
	'icon-pack': 'Icon packs',
	font: 'Fonts',
};

const MAINTAINER_WIDTH = 'w-44';

const STATUS_LABELS: Record<AdminAddonStatus, string> = {
	listed: 'Listed',
	delisted: 'Delisted',
	pending_review: 'Update in review',
	changes_requested: 'Update needs changes',
};

function FilterField({ id, label, children }: FilterFieldProps) {
	return (
		<div className='flex flex-col gap-1.5'>
			<Label htmlFor={id} className='text-muted-foreground text-xs'>
				{label}
			</Label>
			{children}
		</div>
	);
}

function FilterSelect<T extends string>({
	id,
	value,
	options,
	allLabel,
	className,
	onChange,
}: FilterSelectProps<T>) {
	const entries = Object.entries<string>(options);
	const items = [
		{ value: null, label: allLabel },
		...entries.map(([option, label]) => ({ value: option, label })),
	];

	return (
		<Select
			items={items}
			value={value ?? null}
			onValueChange={(next) => onChange(next ?? undefined)}
		>
			<SelectTrigger id={id} className={className}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={null}>{allLabel}</SelectItem>
				{entries.map(([option, label]) => (
					<SelectItem key={option} value={option}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function MaintainerPicker({ id, selected, maintainer, onChange }: MaintainerPickerProps) {
	if (selected) {
		return (
			<div
				className={cn(
					'border-input dark:bg-input/30 flex h-9 items-center gap-2 rounded-md border pr-1 pl-2 text-sm shadow-xs',
					MAINTAINER_WIDTH,
				)}
			>
				{maintainer ? (
					<UserAvatar src={maintainer.image} name={maintainer.name} size='xs' />
				) : null}
				<span className='single-line min-w-0 flex-1'>{maintainer?.name ?? selected}</span>
				<Button
					variant='ghost'
					size='icon'
					className='size-6'
					aria-label='Clear the maintainer filter'
					onClick={() => onChange(undefined)}
				>
					<IconX className='size-4' />
				</Button>
			</div>
		);
	}

	return (
		<UserSearch
			id={id}
			className={MAINTAINER_WIDTH}
			placeholder='Search users...'
			onPick={(user) => onChange(user.id)}
		/>
	);
}

function AddonFilters({ filters, maintainer, onChange }: AddonFiltersProps) {
	const order = filters.order ?? 'desc';
	const filtered = Object.values(filters).some((value) => value !== undefined);

	return (
		<div className='flex flex-wrap items-end gap-3'>
			<FilterField id='addon-filter-type' label='Type'>
				<FilterSelect
					id='addon-filter-type'
					value={filters.type}
					options={TYPE_LABELS}
					allLabel='All types'
					className='w-36'
					onChange={(type) => onChange({ ...filters, type })}
				/>
			</FilterField>
			<FilterField id='addon-filter-status' label='Status'>
				<FilterSelect
					id='addon-filter-status'
					value={filters.status}
					options={STATUS_LABELS}
					allLabel='Any status'
					className='w-52'
					onChange={(status) => onChange({ ...filters, status })}
				/>
			</FilterField>
			<FilterField id='addon-filter-maintainer' label='Maintainer'>
				<MaintainerPicker
					id='addon-filter-maintainer'
					selected={filters.maintainer}
					maintainer={maintainer}
					onChange={(id) => onChange({ ...filters, maintainer: id })}
				/>
			</FilterField>
			<FilterField id='addon-filter-published' label='Published'>
				<DatePicker
					id='addon-filter-published'
					mode='range'
					className='w-64'
					value={{
						from: filters.publishedFrom
							? parseCalendarDate(filters.publishedFrom)
							: undefined,
						to: filters.publishedTo
							? parseCalendarDate(filters.publishedTo)
							: undefined,
					}}
					onChange={({ from, to }) =>
						onChange({
							...filters,
							publishedFrom: from ? formatCalendarDate(from) : undefined,
							publishedTo: to ? formatCalendarDate(to) : undefined,
						})
					}
				/>
			</FilterField>
			<Button
				variant='outline'
				onClick={() =>
					onChange({ ...filters, order: order === 'desc' ? 'asc' : undefined })
				}
			>
				{order === 'desc' ? <IconSortDescending /> : <IconSortAscending />}
				{order === 'desc' ? 'Newest first' : 'Oldest first'}
			</Button>
			{filtered ? (
				<Button variant='ghost' onClick={() => onChange({})}>
					<IconX />
					Clear filters
				</Button>
			) : null}
		</div>
	);
}

export type { AddonFilterValues };

export default AddonFilters;
