import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IconArrowLeft } from 'nucleo-micro-bold';
import { useState } from 'react';

import { formatDate, formatDateTime } from '~/components/admin/format-date';
import { adminUserQuery } from '~/queries/admin-users/admin-users';
import { staggerStyle } from '~/components/motion/reveal-style';
import BlurReveal from '~/components/motion/blur-reveal';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

import type { Tab } from './tab-strip';

import UserActions from './user-actions';
import StatusDot from './status-dot';
import TabStrip from './tab-strip';
import Activity from './activity';

type UserTab = 'addons' | 'activity';

const route = getRouteApi('/_site/_staff/lab/$variant/users/$id');

function UserPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminUserQuery(id));
	const [tab, setTab] = useState<UserTab>('addons');

	if (!view) {
		throw notFound();
	}

	const { user, addons, submissions, events, notes } = view;
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });
	const canWriteNotes = hasPermission(viewer.role, { note: ['write'] });
	const tabs: Tab<UserTab>[] = [
		{ value: 'addons', label: `Addons · ${addons.length}` },
		{ value: 'activity', label: 'Activity' },
	];

	return (
		<div className='flex flex-col gap-6 pb-24'>
			<Link
				to='/lab/$variant/users'
				params={{ variant }}
				className='inline-flex items-center gap-1 w-fit text-muted-foreground hover:text-foreground text-sm'
			>
				<IconArrowLeft className='size-4' />
				All users
			</Link>

			<header className='flex flex-wrap justify-between items-start gap-4'>
				<div className='flex items-center gap-4 min-w-0'>
					<UserAvatar
						src={user.image}
						name={user.name}
						size='lg'
						className='animate-reveal'
						style={staggerStyle(0)}
					/>
					<div className='flex flex-col gap-1.5 min-w-0'>
						<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
							<Text variant='heading-lg' className='truncate'>
								<BlurReveal text={user.name} />
							</Text>
							<span className='animate-reveal' style={staggerStyle(1)}>
								{user.banned ? (
									<StatusDot
										tone='danger'
										label={
											user.banExpires
												? `Banned until ${formatDateTime(user.banExpires)}`
												: 'Banned'
										}
									/>
								) : (
									<StatusDot tone='success' label='Active' />
								)}
							</span>
						</div>
						<Text
							variant='text-sm'
							color='muted'
							className='flex flex-wrap gap-x-2 animate-reveal'
							style={staggerStyle(1)}
						>
							<span className='break-all'>{user.email}</span>
							<span>·</span>
							<span className='capitalize'>{user.role}</span>
							<span>·</span>
							<span>Joined {formatDate(user.createdAt)}</span>
							<span>·</span>
							<span className='font-mono'>{user.id}</span>
						</Text>
						{user.banned && user.banReason ? (
							<Text
								variant='text-sm'
								className='animate-reveal'
								style={staggerStyle(2)}
							>
								<span className='text-muted-foreground'>Ban reason:</span>{' '}
								{user.banReason}
							</Text>
						) : null}
					</div>
				</div>
				<div className='animate-reveal' style={staggerStyle(1)}>
					<UserActions
						user={user}
						canSetRole={canSetRole}
						canBan={canBan}
						isSelf={user.id === viewer.id}
					/>
				</div>
			</header>

			<div className='flex flex-col gap-5 animate-reveal' style={staggerStyle(2)}>
				<TabStrip tabs={tabs} value={tab} onChange={setTab} />

				{tab === 'addons' && addons.length === 0 ? (
					<Card className='p-(--card-pad)'>
						<Text variant='text-sm' color='muted'>
							Maintains no addons.
						</Text>
					</Card>
				) : null}
				{tab === 'addons' && addons.length > 0 ? (
					<Card className='gap-0 py-0 divide-y divide-border overflow-hidden'>
						{addons.map((addon) => (
							<Link
								key={addon.id}
								to='/lab/$variant/addons/$id'
								params={{ variant, id: addon.id }}
								className='flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-muted/30 px-(--card-pad) py-3 transition-colors'
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
								{addon.delistedAt ? (
									<StatusDot tone='neutral' label='Delisted' />
								) : (
									<StatusDot tone='success' label='Listed' />
								)}
							</Link>
						))}
					</Card>
				) : null}

				{tab === 'activity' ? (
					<Activity
						subject={{ type: 'user', id: user.id }}
						notes={notes}
						canWriteNotes={canWriteNotes}
						submissions={submissions}
						submissionLabel='addon'
						events={events}
					/>
				) : null}
			</div>
		</div>
	);
}

export default UserPage;
