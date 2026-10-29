import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { IconChevronRight } from 'nucleo-micro-bold';
import { useQuery } from '@tanstack/react-query';

import { adminUsersQuery } from '~/queries/admin-users/admin-users';
import { ChipRow, SearchChip } from '~/components/staff/chips';
import { formatDate } from '~/components/admin/format-date';
import AdminTable from '~/components/admin/admin-table';
import { TONES } from '~/components/dashboard/status';
import type { AdminUser } from '~/lib/admin-users';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type StaffUserRowProps = {
	user: AdminUser;
};

const COLUMNS = ['User', 'Role', 'Status', 'Joined'];

const route = getRouteApi('/_site/_staff/admin/users/');

/** One user; the whole row opens their page. */
function StaffUserRow({ user }: StaffUserRowProps) {
	return (
		<tr className='group relative hover:bg-muted/30'>
			<td className='px-4 py-3'>
				<div className='flex items-center gap-3 min-w-0'>
					<UserAvatar src={user.image} name={user.name} size='sm' />
					<div className='flex flex-col min-w-0'>
						<Link
							to='/admin/users/$id'
							params={{ id: user.id }}
							className='font-medium truncate after:absolute after:inset-0'
						>
							{user.name}
						</Link>
						<span className='max-w-64 text-muted-foreground text-xs truncate'>
							{user.email}
						</span>
					</div>
				</div>
			</td>
			<td className='px-4 py-3'>
				<Tag variant={user.role === 'user' ? 'default' : 'primary'} className='capitalize'>
					{user.role}
				</Tag>
			</td>
			<td className='px-4 py-3'>
				<span
					className={cn(
						'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[11px] whitespace-nowrap',
						user.banned ? TONES.danger.pill : TONES.success.pill,
					)}
					title={user.banReason ?? undefined}
				>
					<span
						className={cn(
							'rounded-full size-1.5',
							user.banned ? TONES.danger.dot : TONES.success.dot,
						)}
					/>
					{user.banned ? 'Banned' : 'Active'}
				</span>
			</td>
			<td className='px-4 py-3 text-muted-foreground text-sm whitespace-nowrap'>
				{formatDate(user.createdAt)}
			</td>
			<td className='px-4 py-3 w-0 text-muted-foreground group-hover:text-foreground'>
				<IconChevronRight className='size-4' />
			</td>
		</tr>
	);
}

function UsersPage() {
	const params = route.useSearch();
	const { data, isPlaceholderData } = useQuery(adminUsersQuery(params));
	const search = params.q ?? '';
	const navigate = useNavigate({ from: '/admin/users/' });

	if (!data) return null;

	const { items: users, next, prev } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Users'
				description='Everyone with an account. Open one to change their role or ban them.'
			/>

			<ChipRow>
				<SearchChip
					key={search}
					search={search}
					placeholder='Search by id, name or email'
					pending={isPlaceholderData}
					onSearch={(value) => void navigate({ search: { q: value || undefined } })}
				/>
			</ChipRow>

			<AdminTable
				columns={COLUMNS}
				empty={users.length === 0}
				noun='users'
				next={next}
				prev={prev}
			>
				{users.map((user) => (
					<StaffUserRow key={user.id} user={user} />
				))}
			</AdminTable>
		</div>
	);
}

export default UsersPage;
