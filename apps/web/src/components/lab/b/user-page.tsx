import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import { IconArrowLeft, IconChevronRight } from 'nucleo-micro-bold';
import { useSuspenseQuery } from '@tanstack/react-query';

import SubmissionHistory from '~/components/admin/submission-history';
import { adminUserQuery } from '~/queries/admin-users/admin-users';
import { staggerStyle } from '~/components/motion/reveal-style';
import { formatDate } from '~/components/admin/format-date';
import StatusPill from '~/components/dashboard/status-pill';
import BlurReveal from '~/components/motion/blur-reveal';
import StaffNotes from '~/components/admin/staff-notes';
import EventLog from '~/components/admin/event-log';
import UserAvatar from '~/components/user-avatar';
import { hasPermission } from '~/lib/auth/access';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

import type { DocSection } from './settings-doc';

import SettingsDoc, { Fact, SettingsSection } from './settings-doc';
import { BanControl, RoleControl } from './user-controls';

const route = getRouteApi('/_site/_staff/lab/$variant/users/$id');

function UserPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminUserQuery(id));

	if (!view) {
		throw notFound();
	}

	const { user, addons, submissions, events, notes } = view;
	const isSelf = user.id === viewer.id;
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });
	const canWriteNotes = hasPermission(viewer.role, { note: ['write'] });
	const sections: DocSection[] = [
		{ id: 'profile', title: 'Profile' },
		...(canSetRole ? [{ id: 'role', title: 'Role' }] : []),
		...(canBan ? [{ id: 'ban', title: 'Ban' }] : []),
		{ id: 'addons', title: 'Addons' },
		{ id: 'submissions', title: 'Submissions' },
		{ id: 'notes', title: 'Notes' },
		{ id: 'log', title: 'Log' },
	];

	return (
		<div className='flex flex-col gap-8'>
			<div className='flex flex-col gap-3'>
				<Link
					to='/lab/$variant/users'
					params={{ variant }}
					className='inline-flex items-center gap-1 w-fit text-muted-foreground hover:text-foreground text-sm'
				>
					<IconArrowLeft className='size-4' />
					All users
				</Link>
				<div className='flex items-center gap-4 min-w-0'>
					<UserAvatar
						src={user.image}
						name={user.name}
						size='lg'
						className='animate-reveal'
						style={staggerStyle(0)}
					/>
					<div className='flex flex-col gap-1 min-w-0'>
						<Text variant='heading-lg' className='truncate'>
							<BlurReveal text={user.name} />
						</Text>
						<Text
							variant='text-sm'
							color='muted'
							className='animate-reveal'
							style={staggerStyle(1)}
						>
							<span className='capitalize'>{user.role}</span>
							{user.banned ? ' · Banned' : null}
						</Text>
					</div>
				</div>
			</div>

			<div className='animate-reveal' style={staggerStyle(2)}>
				<SettingsDoc sections={sections}>
					<SettingsSection id='profile' title='Profile'>
						<dl className='flex flex-col divide-y divide-border'>
							<Fact label='Email'>
								<span className='break-all'>{user.email}</span>
							</Fact>
							<Fact label='User id'>
								<span className='font-mono'>{user.id}</span>
							</Fact>
							<Fact label='Joined'>{formatDate(user.createdAt)}</Fact>
						</dl>
					</SettingsSection>

					{canSetRole ? (
						<SettingsSection
							id='role'
							title='Role'
							description={
								isSelf
									? 'You cannot change your own role.'
									: 'What this user can do on the site. Changes apply immediately.'
							}
						>
							<RoleControl user={user} disabled={isSelf} />
						</SettingsSection>
					) : null}

					{canBan ? (
						<SettingsSection
							id='ban'
							title='Ban'
							danger={!user.banned}
							description={isSelf ? 'You cannot ban yourself.' : undefined}
						>
							<BanControl user={user} disabled={isSelf} />
						</SettingsSection>
					) : null}

					<SettingsSection
						id='addons'
						title='Addons'
						description='Addons this user owns or maintains.'
					>
						{addons.length === 0 ? (
							<Text variant='text-sm' color='muted'>
								Maintains no addons.
							</Text>
						) : (
							<ul className='flex flex-col divide-y divide-border'>
								{addons.map((addon) => (
									<li key={addon.id}>
										<Link
											to='/lab/$variant/addons/$id'
											params={{ variant, id: addon.id }}
											className='group flex flex-wrap items-center gap-3 py-3'
										>
											<div className='flex flex-col flex-1 min-w-0'>
												<span className='font-medium text-sm group-hover:underline truncate'>
													{addon.name}
												</span>
												<span className='font-mono text-muted-foreground text-xs'>
													{addon.id}
												</span>
											</div>
											<span className='font-mono text-muted-foreground text-sm'>
												{addon.latestVersion ?? 'None'}
											</span>
											<Tag
												variant={
													addon.role === 'owner' ? 'primary' : 'default'
												}
											>
												{addon.role}
											</Tag>
											<StatusPill
												status={addon.delistedAt ? 'delisted' : 'listed'}
											/>
											<IconChevronRight className='size-4 text-muted-foreground' />
										</Link>
									</li>
								))}
							</ul>
						)}
					</SettingsSection>

					<SettingsSection
						id='submissions'
						title='Submissions'
						description='Everything this user submitted, with each review decision.'
					>
						<SubmissionHistory submissions={submissions} label='addon' />
					</SettingsSection>

					<SettingsSection
						id='notes'
						title='Notes'
						description='Private to staff. The user never sees these.'
					>
						<StaffNotes
							subject={{ type: 'user', id: user.id }}
							notes={notes}
							canWrite={canWriteNotes}
						/>
					</SettingsSection>

					<SettingsSection
						id='log'
						title='Log'
						description='Every moderation action on this user, newest first.'
					>
						<EventLog subject={{ type: 'user', id: user.id }} timeline={events} />
					</SettingsSection>
				</SettingsDoc>
			</div>
		</div>
	);
}

export default UserPage;
