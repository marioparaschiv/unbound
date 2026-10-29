import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { IconChevronRight } from 'nucleo-micro-bold';
import { useQuery } from '@tanstack/react-query';

import type { AddonFilterValues } from '~/components/admin/addon-filters';
import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import AddonFilters from '~/components/admin/addon-filters';
import StatusPill from '~/components/dashboard/status-pill';
import SearchForm from '~/components/admin/search-form';
import PageHeader from '~/components/page-header';

import TableCard from './table-card';

const COLUMNS = ['Addon', 'Served', 'Owners', 'Status', ''];

const route = getRouteApi('/_site/_staff/lab/$variant/addons/');

function AddonsPage() {
	const params = route.useSearch();
	const { variant } = route.useParams();
	const { data, isPlaceholderData } = useQuery(adminAddonsQuery(params));
	const { q, cursor: _cursor, dir: _dir, ...filters } = params;
	const search = q ?? '';
	const navigate = useNavigate({ from: '/lab/$variant/addons/' });

	if (!data) return null;

	const { items: addons, next, prev, maintainer } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Addons'
				description='Open an addon to edit its listing, maintainers and visibility.'
			/>

			<TableCard
				toolbar={
					<>
						<SearchForm
							key={search}
							search={search}
							placeholder='Search by id or name...'
							pending={isPlaceholderData}
							onSearch={(value) =>
								navigate({ search: { ...filters, q: value || undefined } })
							}
						/>
						<AddonFilters
							filters={filters}
							maintainer={maintainer}
							onChange={(changed: AddonFilterValues) =>
								navigate({ search: { ...changed, q } })
							}
						/>
					</>
				}
				columns={COLUMNS}
				empty={addons.length === 0}
				noun='addons'
				next={next}
				prev={prev}
			>
				{addons.map((addon) => (
					<tr key={addon.id} className='group relative hover:bg-muted/30'>
						<td className='px-4 py-3'>
							<Link
								to='/lab/$variant/addons/$id'
								params={{ variant, id: addon.id }}
								className='flex flex-col min-w-0 after:absolute after:inset-0 outline-none'
							>
								<span className='font-medium text-sm truncate'>{addon.name}</span>
								<span className='font-mono text-muted-foreground text-xs'>
									{addon.id}
								</span>
							</Link>
						</td>
						<td className='px-4 py-3 font-mono text-muted-foreground text-sm'>
							{addon.latestVersion ?? 'None'}
						</td>
						<td className='px-4 py-3 text-sm'>
							{addon.owners.map((owner) => owner.name).join(', ')}
						</td>
						<td className='px-4 py-3'>
							<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
						</td>
						<td className='px-4 py-3 w-8'>
							<IconChevronRight className='size-4 text-muted-foreground group-hover:text-foreground' />
						</td>
					</tr>
				))}
			</TableCard>
		</div>
	);
}

export default AddonsPage;
