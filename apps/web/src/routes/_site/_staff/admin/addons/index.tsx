import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { adminAddonsSearchSchema } from '@unbound-app/contracts/admin';
import { useQuery } from '@tanstack/react-query';

import type { AddonFilterValues } from '~/components/admin/addon-filters';
import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import AddonActions from '~/components/admin/addon-actions';
import AddonFilters from '~/components/admin/addon-filters';
import AdminTable from '~/components/admin/admin-table';
import SearchForm from '~/components/admin/search-form';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import PageHeader from '~/components/page-header';
import { hasPermission } from '~/lib/auth/access';

const COLUMNS = ['Addon', 'Latest', 'Owners', 'Status'];

function AddonsPage() {
	const { user: viewer } = Route.useRouteContext();
	const params = Route.useSearch();
	const { data, isPlaceholderData } = useQuery(adminAddonsQuery(params));
	const { q, cursor: _cursor, dir: _dir, ...filters } = params;
	const search = q ?? '';
	const navigate = useNavigate({ from: Route.fullPath });
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });

	// The loader filled the cache and a new search keeps the last page, so this holds only while a failure is thrown.
	if (!data) return null;

	const { items: addons, next, prev, maintainer } = data;

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
				pending={isPlaceholderData}
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
	loader: async ({ context, deps, cause }) => {
		// A search, filter or page change on the page keeps the old page up while the list fetches the new one.
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(adminAddonsQuery(deps));
	},
	component: AddonsPage,
});
