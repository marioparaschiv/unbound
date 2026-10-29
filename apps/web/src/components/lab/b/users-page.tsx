import { IconBan, IconChevronRight, IconUserCheck } from 'nucleo-micro-bold';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { adminUsersQuery } from '~/queries/admin-users/admin-users';
import { formatDate } from '~/components/admin/format-date';
import SearchForm from '~/components/admin/search-form';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import Tag from '~/components/tag';

import TableCard from './table-card';

const COLUMNS = ['User', 'Email', 'Role', 'Status', 'Joined', ''];

const route = getRouteApi('/_site/_staff/lab/$variant/users/');

function UsersPage() {
	const params = route.useSearch();
	const { variant } = route.useParams();
	const { data, isPlaceholderData } = useQuery(adminUsersQuery(params));
	const search = params.q ?? '';
	const navigate = useNavigate({ from: '/lab/$variant/users/' });

	if (!data) return null;

	const { items: users, next, prev } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader title='Users' description='Open a user to change their role or ban them.' />

			<TableCard
				toolbar={
					<SearchForm
						key={search}
						search={search}
						placeholder='Search by id, name or email...'
						pending={isPlaceholderData}
						onSearch={(value) => navigate({ search: { q: value || undefined } })}
					/>
				}
				columns={COLUMNS}
				empty={users.length === 0}
				noun='users'
				next={next}
				prev={prev}
			>
				{users.map((user) => (
					<tr key={user.id} className='group relative hover:bg-muted/30'>
						<td className='px-4 py-3'>
							<Link
								to='/lab/$variant/users/$id'
								params={{ variant, id: user.id }}
								className='flex items-center gap-3 after:absolute after:inset-0 outline-none'
							>
								<UserAvatar src={user.image} name={user.name} size='sm' />
								<span className='max-w-[180px] font-medium text-sm truncate'>
									{user.name}
								</span>
							</Link>
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm'>
							<span className='block max-w-[220px] truncate'>{user.email}</span>
						</td>
						<td className='px-4 py-3'>
							<Tag
								variant={user.role === 'user' ? 'default' : 'primary'}
								className='capitalize'
							>
								{user.role}
							</Tag>
						</td>
						<td className='px-4 py-3'>
							{user.banned ? (
								<span className='inline-flex items-center gap-1 text-destructive text-sm'>
									<IconBan className='size-4' />
									Banned
								</span>
							) : (
								<span className='inline-flex items-center gap-1 text-muted-foreground text-sm'>
									<IconUserCheck className='size-4' />
									Active
								</span>
							)}
						</td>
						<td className='px-4 py-3 text-muted-foreground text-sm whitespace-nowrap'>
							{formatDate(user.createdAt)}
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

export default UsersPage;
