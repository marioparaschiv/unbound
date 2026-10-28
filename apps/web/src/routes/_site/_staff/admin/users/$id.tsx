import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router';
import { IconArrowLeft, IconBan, IconUserCheck } from '@tabler/icons-react';

import { formatDate, formatDateTime } from '~/components/admin/format-date';
import SubmissionHistory from '~/components/admin/submission-history';
import DetailSection from '~/components/admin/detail-section';
import StatusPill from '~/components/dashboard/status-pill';
import UserActions from '~/components/admin/user-actions';
import DetailFact from '~/components/admin/detail-fact';
import StaffNotes from '~/components/admin/staff-notes';
import { fetchAdminUser } from '~/lib/admin-functions';
import EventLog from '~/components/admin/event-log';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

function AdminUserPage() {
	const { user: viewer } = Route.useRouteContext();
	const { user, addons, submissions, events, notes } = Route.useLoaderData();
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });
	const canWriteNotes = hasPermission(viewer.role, { note: ['write'] });

	return (
		<div className='flex flex-col gap-8'>
			<div className='flex flex-col gap-4'>
				<Link
					to='/admin/users'
					className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm'
				>
					<IconArrowLeft className='size-4' />
					Users
				</Link>
				<div className='flex flex-wrap justify-between items-start gap-4'>
					<div className='flex items-center gap-4 min-w-0'>
						<UserAvatar src={user.image} name={user.name} size='lg' />
						<div className='flex flex-col gap-1 min-w-0'>
							<Text variant='heading-lg' className='truncate'>
								{user.name}
							</Text>
							<Text variant='text-sm' color='muted' className='font-mono'>
								{user.id}
							</Text>
						</div>
					</div>
					<UserActions
						user={user}
						canSetRole={canSetRole}
						canBan={canBan}
						isSelf={user.id === viewer.id}
					/>
				</div>
				<Card className='gap-4 grid grid-cols-2 md:grid-cols-4 p-(--card-pad)'>
					<DetailFact label='Email'>
						<span className='break-all'>{user.email}</span>
					</DetailFact>
					<DetailFact label='Role'>
						<span className='capitalize'>{user.role}</span>
					</DetailFact>
					<DetailFact label='Status'>
						{user.banned ? (
							<span
								className='inline-flex items-center gap-1 text-destructive'
								title={user.banReason ?? undefined}
							>
								<IconBan className='size-4' />
								Banned
								{user.banExpires
									? ` until ${formatDateTime(user.banExpires)}`
									: null}
							</span>
						) : (
							<span className='inline-flex items-center gap-1 text-green-600 dark:text-green-500'>
								<IconUserCheck className='size-4' />
								Active
							</span>
						)}
					</DetailFact>
					<DetailFact label='Joined'>{formatDate(user.createdAt)}</DetailFact>
					{user.banned && user.banReason ? (
						<DetailFact label='Ban reason'>{user.banReason}</DetailFact>
					) : null}
				</Card>
			</div>

			<DetailSection title='Addons'>
				{addons.length === 0 ? (
					<Card className='p-(--card-pad)'>
						<Text variant='text-sm' color='muted'>
							Maintains no addons.
						</Text>
					</Card>
				) : (
					<Card className='gap-0 p-0 divide-y divide-border'>
						{addons.map((addon) => (
							<Link
								key={addon.id}
								to='/admin/addons/$id'
								params={{ id: addon.id }}
								className='flex flex-wrap items-center gap-3 hover:bg-muted/30 px-4 py-3'
							>
								<div className='flex flex-col flex-1 min-w-0'>
									<span className='font-medium truncate'>{addon.name}</span>
									<span className='font-mono text-muted-foreground text-xs'>
										{addon.id}
									</span>
								</div>
								<span className='font-mono text-muted-foreground text-sm'>
									{addon.latestVersion ?? 'None'}
								</span>
								<Tag variant={addon.role === 'owner' ? 'primary' : 'default'}>
									{addon.role}
								</Tag>
								<StatusPill status={addon.delistedAt ? 'delisted' : 'listed'} />
							</Link>
						))}
					</Card>
				)}
			</DetailSection>

			<DetailSection title='Submissions'>
				<SubmissionHistory submissions={submissions} label='addon' />
			</DetailSection>

			<DetailSection title='Staff notes'>
				<StaffNotes
					subject={{ type: 'user', id: user.id }}
					notes={notes}
					canWrite={canWriteNotes}
				/>
			</DetailSection>

			<DetailSection title='Moderation log'>
				<EventLog
					key={events.items[0]?.id ?? 0}
					subject={{ type: 'user', id: user.id }}
					timeline={events}
				/>
			</DetailSection>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/users/$id')({
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, { user: ['get'] })) {
			throw redirect({ to: '/' });
		}
	},
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ params }) => {
		const view = await fetchAdminUser({ data: params.id });

		if (!view) {
			throw notFound();
		}

		return view;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `Unbound | ${loaderData?.user.name ?? 'User'}` }],
	}),
	component: AdminUserPage,
});
