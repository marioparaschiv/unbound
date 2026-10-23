import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import { IconBan, IconUserCheck } from '@tabler/icons-react';

import UserActions from '~/components/admin/user-actions';
import AdminTable from '~/components/admin/admin-table';
import SearchForm from '~/components/admin/search-form';
import { fetchAdminUsers } from '~/lib/admin-functions';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import Text from '~/components/ui/text';

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

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
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Users</Text>
				<Text variant='text-md' color='muted'>
					Search users, change their roles and ban or unban them.
				</Text>
			</div>

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
							<div className='flex items-center gap-3'>
								<UserAvatar src={user.image} name={user.name} size='sm' />
								<span className='max-w-[150px] font-medium truncate'>
									{user.name}
								</span>
							</div>
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm'>
							<span className='block max-w-[200px] truncate'>{user.email}</span>
						</td>
						<td className='px-4 py-3'>
							<span className='bg-muted px-2 py-0.5 rounded font-medium text-xs capitalize'>
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
							{DATE_FORMAT.format(user.createdAt)}
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

export const Route = createFileRoute('/_site/_staff/admin/users')({
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
