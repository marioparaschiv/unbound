import { getRouteApi, Link, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';

import { adminUsersQuery } from '~/queries/admin-users/admin-users';
import { formatDate } from '~/components/admin/format-date';
import CursorPager from '~/components/admin/cursor-pager';
import SearchForm from '~/components/admin/search-form';
import PageHeader from '~/components/page-header';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

import UserActions from './user-actions';
import StatusDot from './status-dot';

const route = getRouteApi('/_site/_staff/lab/$variant/users/');

function UsersPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const params = route.useSearch();
	const { variant } = route.useParams();
	const { data, isPlaceholderData } = useQuery(adminUsersQuery(params));
	const search = params.q ?? '';
	const navigate = useNavigate({ from: '/lab/$variant/users/' });
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });

	if (!data) return null;

	const { items: users, next, prev } = data;

	return (
		<div className='flex flex-col gap-6'>
			<PageHeader
				title='Users'
				description='Find a user to see their addons and history, change their role or ban them.'
			/>

			<Card className='p-(--card-pad)'>
				<SearchForm
					key={search}
					search={search}
					placeholder='Search by id, name or email...'
					pending={isPlaceholderData}
					onSearch={(value) => navigate({ search: { q: value || undefined } })}
				/>
			</Card>

			<Card className='gap-0 py-0 overflow-hidden'>
				<div className='hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_6rem_6rem_7rem_2.25rem] gap-x-4 bg-muted/50 px-(--card-pad) py-2.5 border-b font-medium text-muted-foreground text-xs'>
					<span>User</span>
					<span>Email</span>
					<span>Role</span>
					<span>Status</span>
					<span>Joined</span>
				</div>
				{users.length === 0 ? (
					<Text
						variant='text-sm'
						color='muted'
						className='px-(--card-pad) py-10 text-center'
					>
						No users match that search.
					</Text>
				) : (
					<ul className='divide-y divide-border'>
						{users.map((user) => (
							<li
								key={user.id}
								className='relative items-center gap-x-4 gap-y-1 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_6rem_6rem_7rem_2.25rem] hover:bg-muted/30 px-(--card-pad) py-3 transition-colors'
							>
								<Link
									to='/lab/$variant/users/$id'
									params={{ variant, id: user.id }}
									className='flex items-center gap-3 min-w-0 after:absolute after:inset-0 outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-halo'
								>
									<UserAvatar src={user.image} name={user.name} size='sm' />
									<span className='font-medium truncate'>{user.name}</span>
								</Link>
								<span className='hidden md:block text-muted-foreground text-sm truncate'>
									{user.email}
								</span>
								<span className='hidden md:block'>
									<Tag className='capitalize'>{user.role}</Tag>
								</span>
								<span className='hidden md:block'>
									{user.banned ? (
										<StatusDot
											tone='danger'
											label='Banned'
											title={user.banReason ?? undefined}
										/>
									) : (
										<StatusDot tone='success' label='Active' />
									)}
								</span>
								<span className='hidden md:block text-muted-foreground text-sm whitespace-nowrap'>
									{formatDate(user.createdAt)}
								</span>
								<div className='z-10 relative'>
									<UserActions
										user={user}
										canSetRole={canSetRole}
										canBan={canBan}
										isSelf={user.id === viewer.id}
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

export default UsersPage;
