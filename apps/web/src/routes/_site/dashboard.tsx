import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { IconUpload } from '@tabler/icons-react';

import SubmissionTimeline from '~/components/dashboard/submission-timeline';
import DashboardSection from '~/components/dashboard/dashboard-section';
import AttentionList from '~/components/dashboard/attention-list';
import UserIdCard from '~/components/dashboard/user-id-card';
import AddonList from '~/components/dashboard/addon-list';
import FirstRun from '~/components/dashboard/first-run';
import { Button } from '~/components/ui/button';
import { getDashboard } from '~/lib/publishing';
import Text from '~/components/ui/text';

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const { addons, timeline, githubLinked } = Route.useLoaderData();

	return (
		<div className='flex flex-col gap-6 md:mx-auto mb-12 px-2 container'>
			<div className='flex flex-wrap justify-between items-end gap-4'>
				<div className='flex flex-col gap-2'>
					<Text variant='heading-lg'>Your Addons</Text>
					<Text variant='text-md' color='muted'>
						Manage what you publish and follow each submission through review.
					</Text>
				</div>
				<Button asChild>
					<Link to='/submit'>
						<IconUpload />
						Submit Addon
					</Link>
				</Button>
			</div>

			<AttentionList addons={addons} githubLinked={githubLinked} />

			<div className='items-start gap-6 grid lg:grid-cols-[1fr_380px]'>
				{addons.length === 0 ? (
					<FirstRun githubLinked={githubLinked} hasSubmitted={timeline.length > 0} />
				) : (
					<DashboardSection title='Addons'>
						<AddonList addons={addons} userId={user.id} githubLinked={githubLinked} />
					</DashboardSection>
				)}

				<aside className='flex flex-col gap-6 min-w-0'>
					{timeline.length > 0 ? (
						<DashboardSection title='Recent submissions'>
							<SubmissionTimeline entries={timeline} />
						</DashboardSection>
					) : null}
					<UserIdCard userId={user.id} />
				</aside>
			</div>
		</div>
	);
}

export const Route = createFileRoute('/_site/dashboard')({
	head: () => ({ meta: [{ title: 'Unbound | Dashboard' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}

		return { user: context.session.user };
	},
	loader: () => getDashboard(),
	component: DashboardPage,
});
