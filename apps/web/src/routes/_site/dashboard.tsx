import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { IconUpload } from '@tabler/icons-react';

import SubmissionTimeline from '~/components/dashboard/submission-timeline';
import DashboardSection from '~/components/dashboard/dashboard-section';
import AttentionList from '~/components/dashboard/attention-list';
import UserIdCard from '~/components/dashboard/user-id-card';
import AddonList from '~/components/dashboard/addon-list';
import FirstRun from '~/components/dashboard/first-run';
import PageHeader from '~/components/page-header';
import { Button } from '~/components/ui/button';
import { getDashboard } from '~/lib/publishing';

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const { addons, timeline, githubLinked } = Route.useLoaderData();

	return (
		<div className='flex flex-col gap-6 page-frame'>
			<PageHeader
				title='Your Addons'
				description='Manage what you publish and follow each submission through review.'
			>
				<Button asChild>
					<Link to='/submit'>
						<IconUpload />
						Submit Addon
					</Link>
				</Button>
			</PageHeader>

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
