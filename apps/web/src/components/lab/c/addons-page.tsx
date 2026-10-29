import {
	IconAscendingSorting,
	IconChevronRight,
	IconDescendingSorting,
	IconPlug,
	IconXmark,
} from 'nucleo-micro-bold';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import type { AdminAddonStatus } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useQuery } from '@tanstack/react-query';

import { ChipMenu, ChipRow, SearchChip, chipClass } from '~/components/lab/c/chips';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { formatCalendarDate, parseCalendarDate } from '~/lib/calendar-date';
import type { AddonFilterValues } from '~/components/admin/addon-filters';
import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import type { LabVariantId } from '~/components/lab/lab-variant';
import StatusPill from '~/components/dashboard/status-pill';
import AdminTable from '~/components/admin/admin-table';
import UserSearch from '~/components/admin/user-search';
import AvatarPile from '~/components/ui/avatar-pile';
import DatePicker from '~/components/ui/date-picker';
import type { AdminAddon } from '~/lib/admin-addons';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import cn from '~/lib/cn';

type StaffAddonRowProps = {
	addon: AdminAddon;
	variant: LabVariantId;
};

type MaintainerChipProps = {
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

const COLUMNS = ['Addon', 'Version', 'Owners', 'Status'];

const route = getRouteApi('/_site/_staff/lab/$variant/addons/');

/** One addon; the whole row opens its page. */
function StaffAddonRow({ addon, variant }: StaffAddonRowProps) {
	return (
		<tr className='group relative hover:bg-muted/30'>
			<td className='px-4 py-3'>
				<div className='flex items-center gap-3 min-w-0'>
					<div className='flex justify-center items-center bg-accent rounded-control size-8 shrink-0'>
						<IconPlug className='size-4' />
					</div>
					<div className='flex flex-col min-w-0'>
						<Link
							to='/lab/$variant/addons/$id'
							params={{ variant, id: addon.id }}
							className='font-medium truncate after:absolute after:inset-0'
						>
							{addon.name}
						</Link>
						<span className='font-mono text-muted-foreground text-xs truncate'>
							{addon.id}
						</span>
					</div>
				</div>
			</td>
			<td className='px-4 py-3 font-mono text-muted-foreground text-sm whitespace-nowrap'>
				{addon.latestVersion ?? 'None'}
			</td>
			<td className='px-4 py-3'>
				<div className='flex items-center gap-2 min-w-0 text-sm'>
					<AvatarPile size={20} totalCount={addon.owners.length} aria-hidden>
						{addon.owners.slice(0, 3).map((owner) => (
							<UserAvatar
								key={owner.id}
								className='size-full text-[8px]'
								src={owner.image}
								name={owner.name}
							/>
						))}
					</AvatarPile>
					<span className='max-w-48 truncate'>
						{addon.owners.map((owner) => owner.name).join(', ') || 'No owner'}
					</span>
				</div>
			</td>
			<td className='px-4 py-3'>
				<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
			</td>
			<td className='px-4 py-3 w-0 text-muted-foreground group-hover:text-foreground'>
				<IconChevronRight className='size-4' />
			</td>
		</tr>
	);
}

function MaintainerChip({ selected, maintainer, onChange }: MaintainerChipProps) {
	if (selected) {
		return (
			<button type='button' className={chipClass(true)} onClick={() => onChange(undefined)}>
				Maintainer: {maintainer?.name ?? selected}
				<IconXmark className='size-3.5 text-muted-foreground' />
				<span className='sr-only'>Clear the maintainer filter</span>
			</button>
		);
	}

	return (
		<Popover>
			<PopoverTrigger type='button' className={chipClass(false)}>
				Maintainer
			</PopoverTrigger>
			<PopoverContent align='start' className='w-80'>
				<UserSearch
					id='c-filter-maintainer'
					placeholder='Search users by name...'
					onPick={(user) => onChange(user.id)}
				/>
			</PopoverContent>
		</Popover>
	);
}

function AddonsPage() {
	const params = route.useSearch();
	const { variant } = route.useParams();
	const { data, isPlaceholderData } = useQuery(adminAddonsQuery(params));
	const { q, cursor: _cursor, dir: _dir, ...filters } = params;
	const navigate = useNavigate({ from: '/lab/$variant/addons/' });
	const order = filters.order ?? 'desc';
	const filtered = Object.values(filters).some((value) => value !== undefined);

	function change(next: AddonFilterValues) {
		void navigate({ search: { ...next, q } });
	}

	if (!data) return null;

	const { items: addons, next, prev, maintainer } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Addons'
				description='Every addon, listed or not. Open one to edit its store page.'
			/>

			<ChipRow>
				<SearchChip
					key={q ?? ''}
					search={q ?? ''}
					placeholder='Search by id or name'
					pending={isPlaceholderData}
					onSearch={(value) =>
						void navigate({ search: { ...filters, q: value || undefined } })
					}
				/>
				<ChipMenu
					label='Type'
					value={filters.type}
					options={TYPE_LABELS}
					anyLabel='All types'
					onChange={(type) => change({ ...filters, type })}
				/>
				<ChipMenu
					label='Status'
					value={filters.status}
					options={STATUS_LABELS}
					anyLabel='Any status'
					onChange={(status) => change({ ...filters, status })}
				/>
				<MaintainerChip
					selected={filters.maintainer}
					maintainer={maintainer}
					onChange={(id) => change({ ...filters, maintainer: id })}
				/>
				<DatePicker
					mode='range'
					placeholder='Published any time'
					className={cn(
						chipClass(Boolean(filters.publishedFrom || filters.publishedTo)),
						'w-auto shadow-none',
					)}
					value={{
						from: filters.publishedFrom
							? parseCalendarDate(filters.publishedFrom)
							: undefined,
						to: filters.publishedTo
							? parseCalendarDate(filters.publishedTo)
							: undefined,
					}}
					onChange={({ from, to }) =>
						change({
							...filters,
							publishedFrom: from ? formatCalendarDate(from) : undefined,
							publishedTo: to ? formatCalendarDate(to) : undefined,
						})
					}
				/>
				<button
					type='button'
					className={chipClass(false)}
					onClick={() =>
						change({ ...filters, order: order === 'desc' ? 'asc' : undefined })
					}
				>
					{order === 'desc' ? (
						<IconDescendingSorting className='size-4' />
					) : (
						<IconAscendingSorting className='size-4' />
					)}
					{order === 'desc' ? 'Newest first' : 'Oldest first'}
				</button>
				{filtered ? (
					<button
						type='button'
						className='px-2 font-medium text-link text-sm hover:underline'
						onClick={() => change({})}
					>
						Clear filters
					</button>
				) : null}
			</ChipRow>

			<AdminTable
				columns={COLUMNS}
				empty={addons.length === 0}
				noun='addons'
				next={next}
				prev={prev}
			>
				{addons.map((addon) => (
					<StaffAddonRow key={addon.id} addon={addon} variant={variant} />
				))}
			</AdminTable>
		</div>
	);
}

export default AddonsPage;
