import type { AdminAddonStatus, AdminAddonsSearch } from '@unbound-app/contracts/admin';
import { IconSortAscending, IconSortDescending, IconX } from '@tabler/icons-react';
import { adminAddonStatusSchema } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { addonTypeSchema } from '@unbound-app/contracts/addons';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useMemo, useState, useTransition } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { toast } from 'sonner';

import getApiErrorMessage from '~/lib/api/error-message';
import { fetchAdminUsers } from '~/lib/admin-functions';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Label from '~/components/ui/label';
import Text from '~/components/ui/text';

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
	all: string;
	onChange: (value: T | undefined) => void;
	parse: (value: string) => T | undefined;
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

const STATUS_LABELS: Record<AdminAddonStatus, string> = {
	listed: 'Listed',
	delisted: 'Delisted',
	pending_review: 'Update in review',
	changes_requested: 'Update needs changes',
};

const SELECT_CLASS =
	'border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

const PICKER_RESULTS = 5;

const SEARCH_DEBOUNCE_MS = 300;

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
	all,
	onChange,
	parse,
}: FilterSelectProps<T>) {
	return (
		<select
			id={id}
			className={SELECT_CLASS}
			value={value ?? ''}
			onChange={(event) => onChange(parse(event.target.value))}
		>
			<option value=''>{all}</option>
			{Object.entries<string>(options).map(([option, label]) => (
				<option key={option} value={option}>
					{label}
				</option>
			))}
		</select>
	);
}

function MaintainerPicker({ id, selected, maintainer, onChange }: MaintainerPickerProps) {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<UserSummary[]>([]);
	const [isSearching, startSearch] = useTransition();

	const searchLater = useMemo(
		() =>
			debounce((q: string) => {
				if (q.length < 3) {
					setResults([]);

					return;
				}

				startSearch(async () => {
					try {
						const page = await fetchAdminUsers({ data: { q } });

						setResults(page.items.slice(0, PICKER_RESULTS));
					} catch (error) {
						toast.error(getApiErrorMessage(error));
					}
				});
			}, SEARCH_DEBOUNCE_MS),
		[],
	);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setQuery(event.target.value);
		searchLater(event.target.value.trim());
	}

	function pick(user: UserSummary) {
		setQuery('');
		setResults([]);
		onChange(user.id);
	}

	if (selected) {
		return (
			<div className='flex items-center gap-2 px-2 border border-input rounded-md h-9 text-sm'>
				{maintainer ? (
					<UserAvatar src={maintainer.image} name={maintainer.name} size='xs' />
				) : null}
				<span className='max-w-[160px] truncate'>{maintainer?.name ?? selected}</span>
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
		<div className='relative'>
			<Input
				id={id}
				className='w-44'
				placeholder='Search users by name...'
				value={query}
				onChange={handleChange}
				autoComplete='off'
			/>
			{results.length > 0 || isSearching ? (
				<div className='top-full left-0 z-10 absolute flex flex-col gap-1 bg-popover shadow-md mt-1 p-1 border border-border rounded-md w-64'>
					{isSearching && results.length === 0 ? (
						<Text variant='text-sm' color='muted' className='px-3 py-2'>
							Searching...
						</Text>
					) : null}
					{results.map((user) => (
						<button
							key={user.id}
							type='button'
							onClick={() => pick(user)}
							className='flex items-center gap-3 hover:bg-accent/50 px-3 py-2 rounded-md text-left transition-colors'
						>
							<UserAvatar src={user.image} name={user.name} size='xs' />
							<Text as='span' variant='text-sm' className='flex-1 truncate'>
								{user.name}
							</Text>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

function parseType(value: string): AddonType | undefined {
	const parsed = addonTypeSchema.safeParse(value);

	return parsed.success ? parsed.data : undefined;
}

function parseStatus(value: string): AdminAddonStatus | undefined {
	const parsed = adminAddonStatusSchema.safeParse(value);

	return parsed.success ? parsed.data : undefined;
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
					all='All types'
					parse={parseType}
					onChange={(type) => onChange({ ...filters, type })}
				/>
			</FilterField>
			<FilterField id='addon-filter-status' label='Status'>
				<FilterSelect
					id='addon-filter-status'
					value={filters.status}
					options={STATUS_LABELS}
					all='Any status'
					parse={parseStatus}
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
			<FilterField id='addon-filter-from' label='Published from'>
				<Input
					id='addon-filter-from'
					type='date'
					className='w-36'
					value={filters.publishedFrom ?? ''}
					onChange={(event) =>
						onChange({ ...filters, publishedFrom: event.target.value || undefined })
					}
				/>
			</FilterField>
			<FilterField id='addon-filter-to' label='Published to'>
				<Input
					id='addon-filter-to'
					type='date'
					className='w-36'
					value={filters.publishedTo ?? ''}
					onChange={(event) =>
						onChange({ ...filters, publishedTo: event.target.value || undefined })
					}
				/>
			</FilterField>
			<Button
				variant='outline'
				onClick={() =>
					// `desc` is the default, so it stays out of the URL.
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
