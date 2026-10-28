import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { adminAddonsSearchSchema } from '@unbound-app/contracts/admin';

import type { AddonFilterValues } from '~/components/admin/addon-filters';
import AddonActions from '~/components/admin/addon-actions';
import AddonFilters from '~/components/admin/addon-filters';
import { fetchAdminAddons } from '~/lib/admin-functions';
import AdminTable from '~/components/admin/admin-table';
import SearchForm from '~/components/admin/search-form';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import PageHeader from '~/components/page-header';
import { hasPermission } from '~/lib/auth/access';

const COLUMNS = ['Addon', 'Latest', 'Owners', 'Status'];

function AddonsPage() {
	const { user: viewer } = Route.useRouteContext();
	const { items: addons, next, prev, maintainer } = Route.useLoaderData();
	const { q, cursor: _cursor, dir: _dir, ...filters } = Route.useSearch();
	const search = q ?? '';
	const navigate = useNavigate({ from: Route.fullPath });
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Addons'
				description='Delist or relist addons and transfer their ownership.'
			/>

			<SearchForm
				key={search}
				search={search}
				placeholder='Search by id or name...'
				onSearch={(value) => navigate({ search: { ...filters, q: value || undefined } })}
			/>

			<AddonFilters
				filters={filters}
				maintainer={maintainer}
				onChange={(changed: AddonFilterValues) => navigate({ search: { ...changed, q } })}
			/>

			<AdminTable
				columns={COLUMNS}
				empty={addons.length === 0}
				noun='addons'
				next={next}
				prev={prev}
				onPageChange={(cursor, dir) =>
					navigate({
						search: (current) => ({
							...current,
							cursor,
							dir: dir === 'prev' ? dir : undefined,
						}),
					})
				}
			>
				{addons.map((addon) => (
					<tr key={addon.id} className='hover:bg-muted/30'>
						<td className='px-4 py-3'>
							<Link
								to='/admin/addons/$id'
								params={{ id: addon.id }}
								className='flex flex-col min-w-0 hover:underline'
							>
								<span className='font-medium truncate'>{addon.name}</span>
								<span className='font-mono text-muted-foreground text-xs'>
									{addon.id}
								</span>
							</Link>
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm'>
							{addon.latestVersion ?? 'None'}
						</td>
						<td className='px-4 py-3 text-sm'>
							{addon.owners.map((owner) => owner.name).join(', ')}
						</td>
						<td className='px-4 py-3 text-sm'>
							{addon.delistedAt ? (
								<span className='text-destructive'>Delisted</span>
							) : (
								<span className='text-green-600 dark:text-green-500'>Listed</span>
							)}
						</td>
						<td className='px-4 py-3 whitespace-nowrap'>
							<AddonActions
								addon={addon}
								canDelist={canDelist}
								canTransfer={canTransfer}
							/>
						</td>
					</tr>
				))}
			</AdminTable>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/addons/')({
	head: () => ({ meta: [{ title: 'Unbound | Addons' }] }),
	validateSearch: adminAddonsSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchAdminAddons({ data: deps }),
	component: AddonsPage,
});
