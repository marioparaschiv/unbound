import { getRouteApi, Link, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import type { AddonFilterValues } from '~/components/admin/addon-filters';
import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import AddonFilters from '~/components/admin/addon-filters';
import CursorPager from '~/components/admin/cursor-pager';
import SearchForm from '~/components/admin/search-form';
import PageHeader from '~/components/page-header';
import { hasPermission } from '~/lib/auth/access';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';

import AddonActions from './addon-actions';
import StatusDot from './status-dot';

const route = getRouteApi('/_site/_staff/lab/$variant/addons/');

function AddonsPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const params = route.useSearch();
	const { variant } = route.useParams();
	const { data, isPlaceholderData } = useQuery(adminAddonsQuery(params));
	const { q, cursor: _cursor, dir: _dir, ...filters } = params;
	const search = q ?? '';
	const navigate = useNavigate({ from: '/lab/$variant/addons/' });
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });

	if (!data) return null;

	const { items: addons, next, prev, maintainer } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Addons'
				description='Find an addon to edit its listing, serve another version or change who maintains it.'
			/>

			<Card className='gap-4 p-(--card-pad)'>
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
			</Card>

			<Card className='gap-0 py-0 overflow-hidden'>
				<div className='hidden md:grid grid-cols-[minmax(0,2fr)_6rem_minmax(0,1.2fr)_7rem_2.25rem] gap-x-4 bg-muted/50 px-(--card-pad) py-2.5 border-b font-medium text-muted-foreground text-xs'>
					<span>Addon</span>
					<span>Serving</span>
					<span>Owners</span>
					<span>Status</span>
				</div>
				{addons.length === 0 ? (
					<Text
						variant='text-sm'
						color='muted'
						className='px-(--card-pad) py-10 text-center'
					>
						No addons match. Try another search or clear the filters.
					</Text>
				) : (
					<ul className='divide-y divide-border'>
						{addons.map((addon) => (
							<li
								key={addon.id}
								className='relative items-center gap-x-4 gap-y-1 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1.2fr)_7rem_2.25rem] hover:bg-muted/30 px-(--card-pad) py-3 transition-colors'
							>
								<Link
									to='/lab/$variant/addons/$id'
									params={{ variant, id: addon.id }}
									className='flex flex-col min-w-0 after:absolute after:inset-0 outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-halo'
								>
									<span className='font-medium truncate'>{addon.name}</span>
									<span className='font-mono text-muted-foreground text-xs truncate'>
										{addon.id}
									</span>
								</Link>
								<span className='hidden md:block font-mono text-muted-foreground text-sm'>
									{addon.latestVersion ?? 'None'}
								</span>
								<span className='hidden md:block text-muted-foreground text-sm truncate'>
									{addon.owners.map((owner) => owner.name).join(', ')}
								</span>
								<span className='hidden md:block'>
									{addon.delistedAt ? (
										<StatusDot tone='neutral' label='Delisted' />
									) : (
										<StatusDot tone='success' label='Listed' />
									)}
								</span>
								<div className='z-10 relative'>
									<AddonActions
										addon={addon}
										canDelist={canDelist}
										canTransfer={canTransfer}
										layout='menu'
									/>
								</div>
							</li>
						))}
					</ul>
				)}
				<CursorPager next={next} prev={prev} />
			</Card>
		</div>
	);
}

export default AddonsPage;
