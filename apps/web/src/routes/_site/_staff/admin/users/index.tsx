import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import { IconBan, IconUserCheck } from '@tabler/icons-react';

import { formatDate } from '~/components/admin/format-date';
import UserActions from '~/components/admin/user-actions';
import AdminTable from '~/components/admin/admin-table';
import SearchForm from '~/components/admin/search-form';
import { fetchAdminUsers } from '~/lib/admin-functions';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';

const COLUMNS = ['User', 'Email', 'Role', 'Status', 'Joined'];

function UsersPage() {
	const { user: viewer } = Route.useRouteContext();
	const { items: users, next, prev } = Route.useLoaderData();
	const search = Route.useSearch().q ?? '';
	const navigate = useNavigate({ from: Route.fullPath });
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Users'
				description='Search users, change their roles and ban or unban them.'
			/>

			<SearchForm
				key={search}
				search={search}
				placeholder='Search by id, name or email...'
				onSearch={(value) => navigate({ search: { q: value || undefined } })}
			/>

			<AdminTable
				columns={COLUMNS}
				empty={users.length === 0}
				noun='users'
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
				{users.map((user) => (
					<tr key={user.id} className='hover:bg-muted/30'>
						<td className='px-4 py-3'>
							<Link
								to='/admin/users/$id'
								params={{ id: user.id }}
								className='flex items-center gap-3 hover:underline'
							>
								<UserAvatar src={user.image} name={user.name} size='sm' />
								<span className='max-w-[150px] font-medium truncate'>
									{user.name}
								</span>
							</Link>
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm'>
							<span className='block max-w-[200px] truncate'>{user.email}</span>
						</td>
						<td className='px-4 py-3'>
							<span className='bg-muted px-2 py-0.5 rounded-full font-medium text-xs capitalize'>
								{user.role}
							</span>
						</td>
						<td className='px-4 py-3'>
							{user.banned ? (
								<span
									className='inline-flex items-center gap-1 text-destructive text-sm'
									title={user.banReason ?? undefined}
								>
									<IconBan className='size-4' />
									Banned
								</span>
							) : (
								<span className='inline-flex items-center gap-1 text-green-600 dark:text-green-500 text-sm'>
									<IconUserCheck className='size-4' />
									Active
								</span>
							)}
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm whitespace-nowrap'>
							{formatDate(user.createdAt)}
						</td>
						<td className='px-4 py-3 whitespace-nowrap'>
							<UserActions
								user={user}
								canSetRole={canSetRole}
								canBan={canBan}
								isSelf={user.id === viewer.id}
							/>
						</td>
					</tr>
				))}
			</AdminTable>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/users/')({
	head: () => ({ meta: [{ title: 'Unbound | Users' }] }),
	validateSearch: adminUsersSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.users.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchAdminUsers({ data: deps }),
	component: UsersPage,
});
