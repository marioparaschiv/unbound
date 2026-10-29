import { getRouteApi, Link, notFound, useRouteContext } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IconArrowLeft } from 'nucleo-micro-bold';
import { useState } from 'react';

import { AddonList, UserFacts, UserHeader } from '~/components/lab/c/user-parts';
import { adminUserQuery } from '~/queries/admin-users/admin-users';
import type { ActivityFilter } from '~/components/lab/c/activity';
import { staggerStyle } from '~/components/motion/reveal-style';
import UserActions from '~/components/admin/user-actions';
import Activity from '~/components/lab/c/activity';
import { hasPermission } from '~/lib/auth/access';
import Text from '~/components/ui/text';

const route = getRouteApi('/_site/_staff/lab/$variant/users/$id');

/** One column like the public profile: header with actions, a facts strip, addons, then activity. */
function UserPage() {
	const { user: viewer } = useRouteContext({ from: '/_site/_staff' });
	const { variant, id } = route.useParams();
	const { data: view } = useSuspenseQuery(adminUserQuery(id));
	const [filter, setFilter] = useState<ActivityFilter>('all');

	if (!view) {
		throw notFound();
	}

	const { user, addons } = view;

	return (
		<div className='flex flex-col gap-8'>
			<Link
				to='/lab/$variant/users'
				params={{ variant }}
				className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm self-start'
			>
				<IconArrowLeft className='size-4' />
				Users
			</Link>
			<UserHeader
				user={user}
				addonCount={addons.length}
				actions={
					<UserActions
						user={user}
						canSetRole={hasPermission(viewer.role, { user: ['set-role'] })}
						canBan={hasPermission(viewer.role, { user: ['ban'] })}
						isSelf={user.id === viewer.id}
					/>
				}
			/>
			<div className='animate-reveal' style={staggerStyle(3)}>
				<UserFacts user={user} />
			</div>
			<section className='flex flex-col gap-4 animate-reveal' style={staggerStyle(4)}>
				<Text as='h2' variant='heading-sm'>
					Addons
				</Text>
				<AddonList addons={addons} variant={variant} />
			</section>
			<Activity
				subject={{ type: 'user', id: user.id }}
				timeline={view.events}
				submissions={view.submissions}
				submissionLabel='addon'
				revealFrom={5}
				notes={view.notes}
				canWriteNotes={hasPermission(viewer.role, { note: ['write'] })}
				filter={filter}
				onFilterChange={setFilter}
			/>
		</div>
	);
}

export default UserPage;
